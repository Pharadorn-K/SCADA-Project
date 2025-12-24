// backend/node/server.js

require('dotenv').config(); // Load .env
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import services
const plcRoutes = require('./routes/api/plc');
const setupWebsocket = require('./routes/websocket');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Routes
app.use('/api/plc', plcRoutes);


// Serve static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Serve index.html ONLY for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});


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