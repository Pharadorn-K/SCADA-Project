// // backend/node/services/pythonBridge.js
// let isRunning = false;

// function start() {
//   if (isRunning) return { success: false };
//   isRunning = true;
//   console.log('🚧 Starting Python PLC service (stub)...');
//   // TODO: spawn Python process or connect via TCP
//   return { success: true };
// }

// function stop() {
//   if (!isRunning) return { success: false };
//   isRunning = false;
//   console.log('🛑 Stopping Python PLC service (stub)...');
//   return { success: true };
// }

// function writeTag(tag, value) {
//   console.log(`✍️ Writing to PLC: ${tag} = ${value} (stub)`);
//   return true; // TODO: forward to Python
// }

// module.exports = { start, stop, writeTag };

// backend/node/services/pythonBridge.js
const net = require('net');
const { updateData } = require('./plcMonitor');

const PYTHON_HOST = '127.0.0.1';
const PYTHON_PORT = parseInt(process.env.PYTHON_PORT) || 8081;

let socket = null;
let isConnected = false;
let reconnectTimeout = null;
let isShuttingDown = false;

// Queue commands if not connected
let commandQueue = [];

function connect() {
  if (isShuttingDown) return;

  socket = new net.Socket();
  
  socket.on('connect', () => {
    console.log('🔗 Connected to Python PLC service');
    isConnected = true;
    
    // Send queued commands
    while (commandQueue.length > 0) {
      const cmd = commandQueue.shift();
      socket.write(JSON.stringify(cmd) + '\n');
    }
  });

  socket.on('data', (data) => {
    const messages = data.toString().split('\n').filter(msg => msg.trim());
    for (const msg of messages) {
      try {
        const payload = JSON.parse(msg);
        if (payload.type === 'plc_data') {
          updateData(payload.tags); // Broadcast via WebSocket
        }
      } catch (err) {
        console.error('❌ Invalid message from Python:', msg, err);
      }
    }
  });

  socket.on('close', () => {
    console.log('🔌 Disconnected from Python PLC service');
    isConnected = false;
    if (!isShuttingDown) {
      scheduleReconnect();
    }
  });

  socket.on('error', (err) => {
    console.error('🚫 Python bridge socket error:', err.message);
    socket.destroy();
  });

  socket.connect(PYTHON_PORT, PYTHON_HOST);
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  console.log('⏳ Reconnecting to Python in 2s...');
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect();
  }, 2000);
}

function sendCommand(cmd) {
  const message = typeof cmd === 'string' ? { cmd } : cmd;
  
  if (isConnected && socket && socket.writable) {
    socket.write(JSON.stringify(message) + '\n');
    return true;
  } else {
    // Queue command if not connected
    commandQueue.push(message);
    if (!reconnectTimeout) connect(); // Trigger reconnect if needed
    return false;
  }
}

// Public API
function start() {
  return sendCommand({ cmd: 'start' });
}

function stop() {
  return sendCommand({ cmd: 'stop' });
}

function writeTag(tag, value) {
  return sendCommand({ cmd: 'write', tag, value });
}

function shutdown() {
  isShuttingDown = true;
  if (socket) socket.destroy();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
}

// Start connection on module load
connect();

module.exports = { start, stop, writeTag, shutdown };