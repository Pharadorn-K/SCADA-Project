// backend/node/server.js
require('dotenv').config(); // Load .env
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const session = require('express-session');

// Initialize global services BEFORE importing modules that depend on them

const stateStore = require('./services/stateStore');
const logService = require('./services/logService');

global.services = {
  logService,  
  stateStore,  
  wss: null // Will be set later
};
logService.loadFromFile(10);
const alarmService = require('./services/alarmService');
global.services.alarmService = alarmService;

// Import services
const plcRoutes = require('./routes/api/plc');
const authRoutes = require('./routes/api/auth');
const auditRoutes = require('./routes/api/audit');
const shiftSummaryRoute = require('./routes/shiftSummary');
// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'scada-secret-dev', // Use strong secret in .env for prod
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize default role for unauthenticated users----------
app.use((req, res, next) => {
  // TEMP: default role (change later after login)
  if (!req.session.role) {
    req.session.role = 'operator';
  }
  next();
});

// API Routes
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/plc', plcRoutes);
app.use('/api/alarms', require('./routes/api/alarm'));
app.use('/api/alarm-history', require('./routes/api/alarmHistory'));
app.use('/api/audit', auditRoutes);
app.use('/api/shift-summary', shiftSummaryRoute);
// Serve static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));


function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  // Redirect to login if not authenticated
  res.redirect('/login.html');
}

// Role-based middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/login.html');
    }
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).send('Access denied');
    }
    next();
  };
}

// Public: Home (any logged-in user)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Public: Production (operators + admins)
app.get('/production', requireRole(['operator', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Maintenance: operators + admins
app.get('/maintenance', requireRole(['operator', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Admin-only
app.get('/admin', requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Catch-all: redirect unknown paths to home (or 404)
app.get('/', requireAuth, (req, res) => {
  res.redirect('/');
});

// Initialize state store
async function bootstrap() {
  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocket.Server({ server });

  global.services.wss = wss;
  console.log('🔄 Hydrating state from database...');
  // Load engines FIRST
  const plcEngine = require('./services/plcEngine');
  const shiftEngine = require('./services/shiftEngine');
  const persistenceEngine = require('./services/persistenceEngine');
  const bootstrapEngine = require('./services/bootstrapEngine');

  // Register globally (only if you want global access)
  global.services.plcEngine = plcEngine;
  global.services.shiftEngine = shiftEngine;
  global.services.persistenceEngine = persistenceEngine;

  // Hydrate state
  await bootstrapEngine.hydrate();
  
  // Start periodic shift save
  persistenceEngine.startDurationTicker();  
  persistenceEngine.startAutoSave();
  shiftEngine.scheduleShiftBoundary();
  console.log('✅ Hydration complete');
  // Websocket + bridge AFTER engines exist
  const plcMonitor = require('./services/plcMonitor');
  const pythonBridge = require('./services/pythonBridge');

  plcMonitor.setWss(wss);

  global.services.plcMonitor = plcMonitor;
  global.services.pythonBridge = pythonBridge;

  setInterval(() => {
    const snapshot = stateStore.getPlcSnapshot();

    plcMonitor.broadcast({
      type: 'plc_snapshot',
      payload: snapshot
    });
    // console.log('📡 Broadcasting snapshot');
    // console.log(snapshot.machines['heat_DKK1'].shiftDurations);
  }, 10000); // every 10 sec

  // Auto-resume last state
  const state = global.services.stateStore.loadState();

  if (state.lastIntent === 'RUNNING') {
    console.log('🔄 Auto-resume: last state was RUNNING');
    setTimeout(() => {
      global.services.pythonBridge.start();
    }, 3000);
  } else {
    console.log('⏸️ Auto-resume: last state was STOPPED');
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    global.services.pythonBridge.shutdown();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  server.listen(PORT, () => {
    console.log(`✅ SCADA Node server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready`);
  });
}



// Start everything
bootstrap().catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
