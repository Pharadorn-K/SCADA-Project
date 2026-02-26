// backend/node/services/pythonBridge.js
const net = require('net');
const { updateData } = require('./plcMonitor');

const PYTHON_HOST = '127.0.0.1';
const PYTHON_PORT = parseInt(process.env.PYTHON_PORT) || 8081;
const alarmService = global.services?.alarmService;
const stateStore = global.services?.stateStore;

// Helper to safely raise alarms
function raiseAlarm(code, message, severity) {
  if (alarmService && typeof alarmService.raise === 'function') {
    alarmService.raise(code, message, severity);
  } else {
    console.warn(`[ALARM] ${severity} - ${code}: ${message}`);
  }
}

// Helper to persist intent
function saveIntent(intent) {
  if (!stateStore) return;
  stateStore.saveState({ lastIntent: intent });
}

let socket = null;
let isConnected = false;
let reconnectTimeout = null;
let isShuttingDown = false;
let plcRunning = false;
let plcConnected = false;
let lastHeartbeat = null;
let plcHealthy = false;
let plcStartTime = null;
let autoRecoverEnabled = true;
let recoverAttempts = 0;
const MAX_RECOVER_ATTEMPTS = 5;
let recovering = false;

// Queue commands if not connected
let commandQueue = [];

function handleMessage(msg) {
  if (msg.type === 'heartbeat') {
    lastHeartbeat = Date.now();
    
    // If transitioning from unhealthy → healthy, raise recovery alarm
    if (!plcHealthy) {
      raiseAlarm(
        'PLC_RECOVERED',
        'PLC heartbeat restored',
        'INFO'
      );
    
    // 👇 CLEAR fault alarms
    global.services.alarmService.clear('PLC_FAULT');
    global.services.alarmService.clear('PLC_DISCONNECTED');
    }
    plcHealthy = true;
    recoverAttempts = 0; // reset on successful heartbeat
    // console.log('💓 PLC heartbeat received');
    return;
  }
  if (msg.type === 'plc_clean') {
    // 1️⃣ Persist canonical state
    global.services.plcEngine.processUpdate(msg.payload);

    // 2️⃣ Fan-out raw event to UI
    try {
      const normalized = msg.payload;
      const key = `${normalized.department.toLowerCase()}_${normalized.machine}`;
      const full = global.services.stateStore.getPlc(key);

      const outPayload = full
        ? {
            // keep original shape fields expected by frontend
            ...normalized,
            // ensure machine_type exists (normalized uses machine_type)
            machine_type: normalized.machine_type ?? full.machineType,
            // include runtime tags (cycle_time, count_shift, etc.) under metrics
            metrics: {
              ...(normalized.metrics || {}),
              ...(full.tags || {})
            },
            // expose runtime extras
            cycleHistory: full.cycleHistory ?? [],
            status: full.status,
            lastUpdate: full.lastUpdate,
            context: full.context ?? normalized.context
          }
        : normalized;

      global.services.plcMonitor.broadcast('plc_clean', outPayload);
    } catch (err) {
      console.error('Error broadcasting plc_clean with full state:', err);
      global.services.plcMonitor.broadcast('plc_clean', msg.payload);
    }

  }
}

// Watchdog: Monitor PLC health
const HEARTBEAT_TIMEOUT = 15000; // 15 seconds
const STARTUP_GRACE = 10000;    // 10 seconds - give PLC time to start
setInterval(() => {
  if (!plcRunning) {
    plcHealthy = false;
    return;
  }

  if (!lastHeartbeat) {
    if (Date.now() - plcStartTime < STARTUP_GRACE) {
      return; // ⏳ still starting
    }
    plcHealthy = false;
    return;
  }

  const diff = Date.now() - lastHeartbeat;

  if (diff > HEARTBEAT_TIMEOUT) {
    if (plcHealthy) {
      console.warn('🐶 PLC Watchdog timeout → FAULT');
      
      // Raise alarm for heartbeat timeout
      raiseAlarm(
        'PLC_FAULT',
        'PLC heartbeat timeout',
        'ERROR'
      );
    }

    plcHealthy = false;

    if (autoRecoverEnabled && plcRunning && !recovering) {
      attemptAutoRecover();
    }
  }
}, 1000);

function attemptAutoRecover() {
  if (recoverAttempts >= MAX_RECOVER_ATTEMPTS) {
    console.error('🚫 Auto-recover failed: max attempts reached');
    return;
  }

  recovering = true;
  recoverAttempts++;

  const delay = Math.min(2000 * recoverAttempts, 10000); // backoff
  console.log(`🔁 Auto-recover attempt ${recoverAttempts} in ${delay}ms`);
  
  // Raise alarm for recovery attempt
  raiseAlarm(
    'PLC_RECOVERING',
    `Auto-recover attempt ${recoverAttempts}`,
    'WARN'
  );

  setTimeout(() => {
    console.log('🔄 Restarting PLC loop');

    // Force reconnect cycle
    if (socket) socket.destroy();

    // Reset heartbeat so watchdog waits
    lastHeartbeat = null;
    plcHealthy = false;
    plcStartTime = Date.now();

    // Send start again
    sendCommand({ cmd: 'start' });

    recovering = false;
  }, delay);
}

function connect() {
  if (isShuttingDown) return;

  socket = new net.Socket();
  
  socket.on('connect', () => {
    console.log('🔗 Connected to Python PLC service');
    isConnected = true;
    plcConnected = true;

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
        handleMessage(payload); // Process heartbeat and other messages
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
    plcConnected = false;
    plcHealthy = false;     // ✅ watchdog failure
    
    // Raise alarm for lost PLC connection
    raiseAlarm(
      'PLC_DISCONNECTED',
      'Lost connection to Python PLC service',
      'ERROR'
    );
    
    if (!isShuttingDown) scheduleReconnect();
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
  if (plcRunning) {
    console.log('⚠️ Start ignored: PLC already running');
    return false;
  }
  saveIntent('RUNNING'); // 🔄 persist intent

  autoRecoverEnabled = true;
  plcRunning = true;
  plcHealthy = true;       // 🔥 assume healthy on start
  lastHeartbeat = Date.now();    // 🔥 set initial timestamp
  plcStartTime = Date.now();
  recoverAttempts = 0;
  return sendCommand({ cmd: 'start' });
}

function stop() {
  if (!plcRunning) return false;

  saveIntent('STOPPED'); // 🔄 persist intent

  autoRecoverEnabled = false;
  plcRunning = false;
  recoverAttempts = 0;
  
  // Raise alarm for manual stop
  raiseAlarm(
    'PLC_STOPPED_MANUAL',
    'PLC stopped by operator',
    'INFO'
  );
  
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

function getStatus() {
  return {
    running: plcRunning,
    connected: plcConnected,
    healthy: plcHealthy,
    lastHeartbeat
  };
}

// Start connection on module load
connect();

module.exports = { start, stop, writeTag, shutdown, getStatus };