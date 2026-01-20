// backend/node/server.js
require('dotenv').config(); // Load .env
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
// Add near top, after other requires
const session = require('express-session');

// Initialize global services BEFORE importing modules that depend on them

const stateStore = require('./services/stateStore');
const logService = require('./services/logService');

global.services = {
  logService,  
  stateStore,  
  wss: null // Will be set later
};

const alarmService = require('./services/alarmService');
global.services.alarmService = alarmService;

// Import services
const plcRoutes = require('./routes/api/plc');
const setupWebsocket = require('./routes/websocket');
// Add after other route imports
const authRoutes = require('./routes/api/auth');
const auditRoutes = require('./routes/api/audit');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// After app initialization, before routes
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

// Add before other app.use(...)
// app.use('/api/auth', authRoutes);
app.use('/api/auth', require('./routes/api/auth'));

// API Routes
app.use('/api/plc', plcRoutes);
app.use('/api/alarms', require('./routes/api/alarm'));
app.use('/api/alarm-history', require('./routes/api/alarmHistory'));
app.use('/api/audit', auditRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));
// Add before app.get('/') for index.html

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

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Add wss to global services
global.services.wss = wss;

// Import and initialize shared services
const pythonBridge = require('./services/pythonBridge');
const plcMonitor = require('./services/plcMonitor');

// Add pythonBridge and plcMonitor to global services
global.services.pythonBridge = pythonBridge;
global.services.plcMonitor = plcMonitor;

// Auto-resume last state
const state = global.services.stateStore.loadState();

if (state.lastIntent === 'RUNNING') {
  console.log('🔄 Auto-resume: last state was RUNNING');
  setTimeout(() => {
    global.services.pythonBridge.start();
  }, 3000); // wait for Python bridge to stabilize
} else {
  console.log('⏸️ Auto-resume: last state was STOPPED');
}

// Set up WebSocket message handling & broadcast
setupWebsocket(wss, plcMonitor);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  global.services.pythonBridge.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ SCADA Node server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

