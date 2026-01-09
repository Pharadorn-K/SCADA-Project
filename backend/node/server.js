// backend/node/server.js

require('dotenv').config(); // Load .env
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
// Add near top, after other requires
const session = require('express-session');

// Import services
const plcRoutes = require('./routes/api/plc');
const setupWebsocket = require('./routes/websocket');
// Add after other route imports
const authRoutes = require('./routes/api/auth');


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
// Add before other app.use(...)
app.use('/api/auth', authRoutes);
// API Routes
app.use('/api/plc', plcRoutes);


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

// Update root route
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});
// // Serve index.html ONLY for root
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
// });


// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Import and initialize shared services
const pythonBridge = require('./services/pythonBridge');
const plcMonitor = require('./services/plcMonitor');

// Share services across modules (or use dependency injection in larger apps)
global.services = {
  pythonBridge,
  plcMonitor,
  wss
};

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

