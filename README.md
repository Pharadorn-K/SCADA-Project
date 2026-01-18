# Machine Monitoring App 📖

This project is a hybrid desktop & web application built with **Tkinter** and **Flask**, connected to a **MySQL** database.  
It provides:
- A desktop GUI to manage settings (Tkinter).📊
- A Flask web server for dashboards (HTML/CSS/JS).🖥️
- AI module for anomaly detection in machine cycle time.🧠
- MySQL integration for real-time data logging.🗄️

---
# Prepare your computer 🚀

1.Clone the repository
- Place Link to (GitHub desktop) in clone function with URL.
```bash
git clone https://github.com/Sunstar-TH/Production-Monitoring-Project-SCADA-.git
```
2.Install requirements pip
- Run this code in your termianl to install all request pip.
```bash
pip install -r requirements.txt
npm install express-session bcryptjs
```
3.Program test run:

- Terminal 1 python_loop - PLC 
```bash
cd backend/python
python plc_service.py
```
- Terminal 2 server
```bash
cd backend/node
npm run dev
```
```bash
node generate-hash.js
```
---
# Note 💡
- You have to confirm that your computer can access PLC and MySQL before run any functions in program.
```bash
# PLC location
ping 10.207.1.24

#MySQL location
ping 10.207.1.84
```



from this structure :
scada-project/ 
│ 
├── backend/ 
│   ├── python/ 
│   │   ├── __init__.py 
│   │   ├── plc_service.py              # ✅ Main orchestrator: start/stop/read/write loop + DB 
│   │   ├── plc_loop.py                 # 🔁 Dedicated 1-sec loop (logic moved from service) 
│   │   └── utils/
│   │       ├── clean_data.py
│   │       ├── db_connector.py
│   │       ├── plc_driver.py           # 🛠️ Low-level PLC comms (e.g., pycomm3, snap7) 
│   │       └── db_writer.py            # 📝 DB insert/update logic (decoupled from loop) 
│   └── node/ 
│       ├── server.js                   # ✅ Entry point: HTTP + WebSocket server (ws or socket.io) 
│       ├── package.json 
│       ├── package-lock.json 
│       ├── .env                        
│       ├── node_modules/ ...
│       ├── routes/ 
│       │   ├── api/                    # REST endpoints (e.g., /api/plc/start) 
│       │   │   ├── alam.js   
│       │   │   ├── audit.js   
│       │   │   ├── auth.js              
│       │   │   └── plc.js              
│       │   └── websocket.js            # 🔄 WS message handler (e.g., broadcast PLC data) 
│       ├── data/ 
│       │   └── systemState.json
│       ├── logs/ 
│       │   └── scada.log
│       ├── middleware/ 
│       │   └── requireRole.js
│       └── services/ 
│           ├── alarmService.js
│           ├── logService.js
│           ├── dbService.js
│           ├── stateStore.js  
│           ├── pythonBridge.js          
│           └── plcMonitor.js           
│ 
├── frontend/ 
│   ├── public/                        
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── css/
│   │   │   └── main.css
│   │   └── js/
│   │       ├── app.js
│   │       ├── api.js
│   │       ├── store.js
│   │       └── views/            
│   │           ├── home.js
│   │           ├── production.js
│   │           ├── maintenance.js
│   │           └── admin.js
│   └── src/                            
│       ├── main.js                     
│       ├── dashboard.js                
│       ├── api.js                      
│       └── styles/ 
│           └── main.css 
│
├── database/ 
│   ├── migrations/                     # 🆕 Add: e.g., 001_init.sql, 002_add_tags.sql 
│   ├── schema.sql                      # ✅ Keep 
│   └── seed.sql                        # 🆕 Optional: sample data 
│ 
├── scripts/ 
│   ├── start-dev.sh                    # 🆕 Helper: run Node + Python in parallel (or use npm scripts) 
│   └── deploy.sh
│ 
├── .gitignore 
├── README.md 
└── docker-compose.yml                  # 🆕 Optional (for prod-like env: DB + Node + Python)


// backend/node/package.json
{
  "name": "node",
  "version": "1.0.0",
  "description": "",
  "main": "server.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node server.js",
    "dev": "nodemon --ignore data/systemState.json server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "express-session": "^1.18.2",
    "ws": "^8.18.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.11"
  }
}


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

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login.html');
}

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


# backend/node/.env
PLC_IP="10.207.1.24"
PLC_PORT_A=5010
PLC_PORT_B=5011
PLC_PORT_C=5012
TCP_HOST="127.0.0.1"
TCP_PORT=8081

DB_HOST=10.207.1.87
DB_PORT=3306
DB_USER=PCSET077
DB_PASSWORD=123456
DB_NAME=raw
DB_MIN=1
DB_MAX=5

BIT_HEAD=B0
BIT_SIZE=7168

WORD_HEAD_A=W0
WORD_HEAD_B=W3C0
WORD_HEAD_C=W780
WORD_HEAD_D=W0B40
WORD_HEAD_E=W0F00
WORD_HEAD_F=W12C0
WORD_HEAD_G=W1680
WORD_SIZE=960


// backend/node/services/alarmService.js
const alarms = [];
let lastAlarmCode = null;

function raise(code, message, severity = 'ERROR') {
  if (code === lastAlarmCode) return;

  const alarm = {
    id: Date.now(),              // 👈 unique ID
    time: new Date().toISOString(),
    code,
    message,
    severity,
    acknowledged: false,         // 👈 NEW
    ackBy: null,
    ackTime: null,
    cleared: false,          // 👈 NEW
    clearTime: null
  };

  alarms.push(alarm);
  lastAlarmCode = code;

  console.log(`🚨 [${severity}] ${code} - ${message}`);

  // ✅ SAFE: global.services exists by now
  const logService = global.services?.logService;
  if (logService) {
    logService.log({
      type: 'ALARM',
      severity,
      code,
      message,
      user: 'system',
      role: 'system'
    });
  }
}

function acknowledge(id, user) {
  const alarm = alarms.find(a => a.id === id);
  if (!alarm || alarm.acknowledged) return false;

  alarm.acknowledged = true;
  alarm.ackBy = user;
  alarm.ackTime = new Date().toISOString();

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user,
    role: 'operator',
    action: 'ACK_ALARM',
    code: alarm.code,
    message: 'Alarm acknowledged'
  });

  return true;
}

function clear(code) {
  const alarm = [...alarms].reverse().find(
    a => a.code === code && !a.cleared
  );

  if (!alarm) return false;

  alarm.cleared = true;
  alarm.clearTime = new Date().toISOString();
  lastAlarmCode = null;

  console.log(`✅ [CLEAR] ${code}`);

  global.services.logService.log({
    type: 'ALARM',
    severity: 'INFO',
    code,
    message: 'Alarm cleared (condition recovered)',
    user: 'system',
    role: 'system'
  });

  return true;
}

function getAll() {
  return alarms.slice(-100);
}

module.exports = { raise, clear, getAll , acknowledge };


// backend/node/services/logService.js
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'scada.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('❌ Log write failed', err);
  });
}

function log({
  type,
  severity = 'INFO',
  user = 'system',
  role = 'system',
  action = null,
  code = null,
  message = '',
  meta = {}
}) {
  writeLog({
    ts: new Date().toISOString(),
    type,
    severity,
    user,
    role,
    action,
    code,
    message,
    meta
  });
}

module.exports = { log };


// backend/node/services/plcMonitor.js
let latestData = {};
let wss = null;

function updateData(data) {
  latestData = data;
  if (wss) {
    const payload = JSON.stringify({ type: 'plc_update', data });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

function getLatestData() {
  return latestData;
}

function setWss(webSocketServer) {
  wss = webSocketServer;
}

module.exports = { updateData, getLatestData, setWss };


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
    console.log('💓 PLC heartbeat received');
    return;
  }
}

// Watchdog: Monitor PLC health
const HEARTBEAT_TIMEOUT = 5000; // 5 seconds
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
    // plcRunning stays TRUE
    
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


// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../data/systemState.json');

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { lastIntent: 'STOPPED' };
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ Failed to load system state:', err.message);
    return { lastIntent: 'STOPPED' };
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('❌ Failed to save system state:', err.message);
  }
}

module.exports = {
  loadState,
  saveState
};


// backend/node/routes/websocket.js
module.exports = (wss, plcMonitor) => {
  wss.on('connection', (ws) => {
    console.log('🟢 New WebSocket client connected');

    // Optional: send current state on connect
    const latestData = plcMonitor.getLatestData();
    if (latestData) {
      ws.send(JSON.stringify({ type: 'plc_update', data: latestData }));
    }

    ws.on('close', () => {
      console.log('🔴 WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // Attach wss to plcMonitor so it can broadcast
  plcMonitor.setWss(wss);
};


// backend/node/routes/api/alarm.js
// module.exports = router;
const express = require('express');
const router = express.Router();
// const { requireRole } = require('../../middleware/requireRole');, requireRole('admin'), requireRole('admin')

router.get('/', (req, res) => {
  res.json(global.services.alarmService.getAll());
});

router.post('/ack/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = req.session.userId;

  const ok = global.services.alarmService.acknowledge(id, user);
  res.json({ ok });
});

module.exports = router;



// backend/node/routes/api/audit.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const LOG_FILE = path.join(__dirname, '../../logs/scada.log');

/* 🔐 Admin guard */
function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

/* GET /api/audit */
router.get('/', requireAdmin, (req, res) => {
  const {
    limit = 100,
    action,
    user,
    from,
    to
  } = req.query;

  if (!fs.existsSync(LOG_FILE)) {
    return res.json([]);
  }

  const lines = fs
    .readFileSync(LOG_FILE, 'utf-8')
    .trim()
    .split('\n')
    .reverse(); // newest first

  const results = [];

  for (const line of lines) {
    if (results.length >= limit) break;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'AUDIT') continue;
    if (action && entry.action !== action) continue;
    if (user && entry.user !== user) continue;

    const ts = new Date(entry.ts).getTime();
    if (from && ts < new Date(from).getTime()) continue;
    if (to && ts > new Date(to).getTime()) continue;

    results.push(entry);
  }

  res.json(results);
});

module.exports = router;


// backend/node/routes/api/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Hardcoded user for demo (replace with DB in real app)
const VALID_USERS = [
  { 
    username: 'admin', 
    passwordHash: '$2b$10$dcsYRXvpYuRZ2nJ1Z0.R6.IYGum/iFKQol/.x6yGY8LoX23SF5Li2', //'scada123'
    role: 'admin' 
  },
  {
    username: 'operator',
    passwordHash: '$2b$10$KtV1W2Djxtgv8ap3IAxMPeP7vWgt.uQyhxY7HyC30i0vfcV05k.cK', //'user2026'
    role: 'operator'
  }
];

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password }); // ← see what's received

  const user = VALID_USERS.find(u => u.username === username);
  if (user) {
    console.log('Stored hash:', user.passwordHash);
    console.log('Password matches?', bcrypt.compareSync(password, user.passwordHash));
  }

  // In /login route
  if (user && bcrypt.compareSync(password, user.passwordHash)) {
    req.session.userId = username;
    req.session.role = user.role; // 👈 store role
    global.services.logService.log({
      type: 'AUDIT',
      severity: 'INFO',
      user: req.session.userId || 'unknown',
      role: req.session.role || 'unknown',
      action: 'LOGIN',
      message: 'User logged in'
    });
    return res.json({ success: true });

  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'LOGOUT',
    message: 'User logged out'
  });
});

router.get('/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.userId,
    username: req.session.userId || null,
    role: req.session.role || null // 👈 include role
  });
});

// TEMP: Simple role switch for testing (remove in production)
router.post('/switch-role', (req, res) => {
  const { role } = req.body;

  if (!['operator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  req.session.role = role;
  res.json({ success: true, role });
});

module.exports = router;


// backend/node/routes/api/plc.js
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/requireRole');

router.get('/status', (req, res) => {
  const status = global.services.pythonBridge.getStatus();
  res.json(status);
});

router.post('/start',requireRole('admin'), (req, res) => {
  const ok = global.services.pythonBridge.start();

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'START_PLC',
    message: 'PLC start requested'
  });

  res.json({ ok });
});

router.post('/stop', requireRole('admin'), (req, res) => {
  const ok = global.services.pythonBridge.stop();

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'STOP_PLC',
    message: 'PLC stop requested'
  });

  res.json({ ok });
});
router.post('/write', requireRole('admin'), (req, res) => {
  const { tag, value } = req.body;
  const ok = global.services.pythonBridge.writeTag(tag, value);

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'WRITE_PLC_TAG',
    message: 'PLC tag write requested'
  });

  res.json({ ok });
});

module.exports = router;


// backend/node/middleware/requireRole.js
function requireRole(requiredRole) {
  return (req, res, next) => {
    const role = req.session?.role;

    if (!role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

module.exports = { requireRole };


// backend/node/data/systemState.json
{
  "lastIntent": "STOPPED"
}


<!-- // frontend/public/login.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SET SCADA : Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: "Poppins", sans-serif;
    }

    body {
      background: #4973ff;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
    }

    /* Wave Background */
    .wave {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      box-shadow: inset 0 0 50px rgba(255, 255, 255, 0.5);
    }
    .wave span {
      position: absolute;
      width: 700vh;
      height: 700vh;
      top: -900px;
      left: 50%;
      transform: translate(-50%, -75%);
      background: #ffffff;
    }
    .wave span:nth-child(1) {
      border-radius: 45%;
      background: rgb(255, 255, 255);
      animation: animate 20s linear infinite;
    }
    .wave span:nth-child(2) {
      border-radius: 40%;
      background: rgba(255, 255, 255, 0.5);
      animation: animate 30s linear infinite;
    }
    .wave span:nth-child(3) {
      border-radius: 42.5%;
      background: rgba(186, 215, 248, 0.5);
      animation: animate 40s linear infinite;
    }

    @keyframes animate {
      0% {
        transform: translate(-50%, -75%) rotate(0deg);
      }
      100% {
        transform: translate(-50%, -75%) rotate(360deg);
      }
    }

    /* Login Card (unchanged, but adjusted for contrast) */
    .login-card {
      background: rgba(255, 255, 255, 0.92); /* Slight transparency for depth */
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      width: 320px;
      z-index: 2;
    }
    .login-card h2 {
      text-align: center;
      margin-bottom: 1.5rem;
      color: #1976d2;
    }
    .form-group input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    .btn {
      width: 100%;
      padding: 0.75rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: background 10s;
    }
    .btn:hover {
      background: #1565c0;
    }
    .error {
      color: #d32f2f;
      text-align: center;
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }
  </style>

</head>
<body>
  <!-- Animated wave background -->
  <div class="wave">
    <span></span>
    <span></span>
    <span></span>
  </div>

  <!-- Login Form -->
  <div class="login-card">
    <h2>SCADA Login</h2>
    <form id="loginForm">
      <div class="form-group">
        <input type="text" id="username" placeholder="Username" required />
      </div>
      <div class="form-group">
        <input type="password" id="password" placeholder="Password" required />
      </div>
      <button type="submit" class="btn">Login</button>
    </form>
    <div id="error" class="error"></div>
  </div>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('error');
      errorEl.textContent = '';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
          })
        });

        const data = await res.json();
        if (data.success) {
          window.location.href = '/'; // Redirect to dashboard
        } else {
          errorEl.textContent = data.message || 'Login failed';
        }
      } catch (err) {
        errorEl.textContent = 'Network error';
      }
    });
  </script>
</body>
</html>


<!-- // frontend/public/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SCADA.SET</title>
    <link rel="stylesheet" href="/css/main.css">
  </head>
  <body>
    <header>
      <h1>SCADA.SET</h1>
    </header>
    <nav id="main-nav"></nav>
    <main id="app"></main>
    
    <script type="module" src="/js/app.js"></script>
  </body>
</html>


/* frontend/public/css/main.css */
body {
    font-family: sans-serif;
    margin: 0;
    background: #f5f5f5;
}
nav {
    background: #1976d2;
    padding: 0 20px;
    display: flex;
    gap: 20px;
}
nav a {
    color: white;
    text-decoration: none;
    padding: 15px 10px;
    display: block;
}
nav a:hover, nav a.active {
    background: #1565c0;
}
main {
    padding: 20px;
}
.page { display: none; }
.page.active { display: block; }
.card {
    background: white;
    padding: 15px;
    margin: 10px 0;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
button {
    padding: 8px 16px;
    margin: 5px;
    font-size: 14px;
}
pre {
    background: #eee;
    padding: 10px;
    overflow: auto;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 0.85rem;
  margin-left: 8px;
}

.badge-green {
  background: #4caf50;
  color: white;
}

.badge-red {
  background: #f44336;
  color: white;
}

.badge-gray {
  background: #9e9e9e;
  color: white;
}

.alarm-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.alarm {
  padding: 8px;
  margin-bottom: 6px;
  border-left: 6px solid;
  background: #fff3f3;
}

.alarm.error {
  border-color: #d32f2f;
}

.alarm.warn {
  border-color: #f57c00;
}

.alarm info {
  border-color: #1976d2;
}

.alarm small {
  display: block;
  opacity: 0.7;
  font-size: 0.8em;
}


// frontend/public/js/app.js
import { homeView, homeMount, homeUnmount } from './views/home.js';
import { productionView, productionMount, productionUnmount } from './views/production.js';
import { maintenanceView, maintenanceMount, maintenanceUnmount } from './views/maintenance.js';
import { adminView, adminMount, adminUnmount } from './views/admin.js';

let currentUnmount = null;
let currentUserRole = null;


// Auth check
async function checkAuth() {
  const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
  const auth = await res.json();
  if (!auth.authenticated) {
    window.location.href = '/login.html';
    return false;
  }
  currentUserRole = auth.role;
  renderNav();
  return true;
}


function renderNav() {
  const nav = document.getElementById('main-nav');

  // Build nav HTML with data-page
  let navHTML = `
    <a href="#" data-page="home">🏠 Home</a>
    <a href="#" data-page="production">🏭 Production</a>
    <a href="#" data-page="maintenance">🔧 Maintenance</a>
  `;

  if (currentUserRole === 'admin') {
    navHTML += `<a href="#" data-page="admin">⚙️ Admin</a>`;
  }

  navHTML += `<a href="#" id="logout-link">🚪 Logout</a>`;
  nav.innerHTML = navHTML;

  // Bind click handlers
  nav.querySelectorAll('a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigate(page);
    });
  });

  // Bind logout
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/login.html';
}


import { scadaStore } from './store.js';

function initWebSocket() {
  if (scadaStore.ws) return;

  // const ws = new WebSocket('ws://localhost:3000');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}`);

  scadaStore.ws = ws;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'plc_update') {
      scadaStore.setData(msg.data); // notify all subscribers
    }
  };

  ws.onopen = () => console.log('WS connected');
  ws.onclose = () => {
    console.log('WS disconnected');
    setTimeout(initWebSocket, 2000); // auto-reconnect
  };
}


// Main router
export async function navigate(page) {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Cleanup previous
  if (currentUnmount) currentUnmount();

  const app = document.getElementById('app');

  switch (page) {
    case 'home':
      app.innerHTML = homeView();
      homeMount?.();
      currentUnmount = homeUnmount;
      break;
    case 'production':
      app.innerHTML = productionView();
      productionMount?.();
      currentUnmount = productionUnmount;
      break;
    case 'maintenance':
      app.innerHTML = maintenanceView();
      maintenanceMount?.();
      currentUnmount = maintenanceUnmount;
      break;
    case 'admin':
      if (currentUserRole !== 'admin') {
        alert('Access denied');
        return;
      }
      app.innerHTML = adminView();
      adminMount?.();
      currentUnmount = adminUnmount;
      break;
    default:
      navigate('home');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  // Restore page from URL hash or default to home
  const page = window.location.hash.slice(1) || 'home';
  navigate(page);
});


// frontend/public/js/api.js
export async function sendPlcCommand(endpoint) {
  const res = await fetch(`/api/plc/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  });
  return res.json();
}

export async function writePlcTag(tag, value) {
  const res = await fetch('/api/plc/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ tag, value })
  });
  return res.json();
}


// frontend/public/js/store.js
export const scadaStore = {
  latestPlcData: null,
  ws: null,
  listeners: [], // functions to call when data updates

  setData(data) {
    this.latestPlcData = data;
    this.listeners.forEach(fn => fn(data));
  },
  
  subscribe(fn) {
    this.listeners.push(fn);

    // 🔥 Immediately send latest data
    if (this.latestPlcData) {
      fn(this.latestPlcData);
    }

    return () => {
      this.listeners = this.listeners.filter(f => f !== fn);
    };
  }

};


// frontend/public/js/views/home.js
export function homeView() {
  return `
      <h1>🏭 SCADA Dashboard – Home</h1>
      <div class="card">
        <p>Welcome to the SCADA system.</p>
        <p>Use navigation above to switch views.</p>
      </div>
  `;
}

export function homeMount() {
}

export function homeUnmount() {
}


// frontend/public/js/views/production.js
export function productionView() {
  return `
    <h2>🏭 Production Monitoring</h2>

    <div class="card">
      <h3>📡 Live PLC Data</h3>
      <pre id="plc-data">No data...</pre>
    </div>

    <div class="card">
      <h3>🚨 Active Alarms</h3>
      <ul id="alarm-list" class="alarm-list"></ul>
    </div>
  `;
}
import { scadaStore } from '../store.js';

let unsubscribe = null;
let alarmTimer = null;

export async function productionMount() {
  const dataEl = document.getElementById('plc-data');
  const alarmList = document.getElementById('alarm-list');
  alarmList.onclick = async (e) => {
    if (!e.target.classList.contains('ack-btn')) return;

    const id = e.target.dataset.id;

    await fetch(`/api/alarms/ack/${id}`, {
      method: 'POST',
      credentials: 'same-origin'
    });

    loadAlarms();
  };

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });

  async function loadAlarms() {
    const res = await fetch('/api/alarms', {
      credentials: 'same-origin'
    });

    if (!res.ok) {
      console.warn('Alarm fetch failed:', res.status);
      alarmList.innerHTML = '<li>No alarm access</li>';
      return;
    }

    const alarms = await res.json();

    if (!Array.isArray(alarms)) {
      console.warn('Alarm response not array:', alarms);
      return;
    }

  alarmList.innerHTML = alarms
    .slice()
    .reverse()
    .map(a => `
      <li class="alarm ${a.severity.toLowerCase()} ${a.acknowledged ? 'ack' : ''}">
        <strong>${a.code}</strong>
        <span>${a.message}</span>
        <small display="float:right">${new Date(a.time).toLocaleTimeString()}</small>
        ${
          a.acknowledged
            ? `<small>✔ ACK by ${a.ackBy}</small>`
            : `<button data-id="${a.id}" class="ack-btn">ACK</button>`
        }
      </li>
    `)
  .join('');
  }

  await loadAlarms();
  alarmTimer = setInterval(loadAlarms, 2000);
}

export function productionUnmount() {
  if (unsubscribe) unsubscribe();
  if (alarmTimer) clearInterval(alarmTimer);
}


// frontend/public/js/views/maintenance.js
export function maintenanceView() {
  return `
      <h1>🔧 Maintenance</h1>
      <div class="card">
        <p>Schedule maintenance, view logs, calibrate sensors.</p>
        <!-- Add your maintenance tools here -->
      </div>
  `;
}

export function maintenanceMount() {
}

export function maintenanceUnmount() {
}


// frontend/public/js/views/admin.js
export function adminView() {
  return `
      <h1>⚙️ Admin Panel</h1>
      <p>Manage PLC and view real-time data.</p>
      <div class="card">
        <strong>Status:</strong>
        <span id="plc-badge" class="badge badge-gray">UNKNOWN</span>
      </div>

      <div class="card">
        <button id="btn-start">▶️ Start</button>
        <button id="btn-stop">⏹️ Stop</button>
        <input id="write-tag" placeholder="Tag" value="B10">
        <input id="write-value" type="number" value="1">
        <button id="btn-write">✍️ Write</button>
      </div>

      <div class="card">
        <h3>🚨 Active Alarms</h3>
        <ul id="alarm-list" class="alarm-list"></ul>
      </div>

  `;
}

import { sendPlcCommand } from '../api.js';

let alarmTimer = null;
async function refreshPlcStatus() {
  const res = await fetch('/api/plc/status', {
    credentials: 'same-origin'
  });
  return res.json();
}


function updateUIFromStatus(status) {
  const badge = document.getElementById('plc-badge');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');

  if (!status.connected && status.running) {
    badge.textContent = 'PLC FAULT';
    badge.className = 'badge badge-red';
    btnStart.disabled = true;
    btnStop.disabled = false;
  }
  else if (!status.connected) {
    badge.textContent = 'DISCONNECTED';
    badge.className = 'badge badge-gray';
    btnStart.disabled = true;
    btnStop.disabled = true;
  }
  else if (status.running && !status.healthy) {
    badge.textContent = 'PLC FAULT';
    badge.className = 'badge badge-red';
    btnStart.disabled = true;
    btnStop.disabled = false;
  }
  else if (status.running) {
    badge.textContent = 'RUNNING';
    badge.className = 'badge badge-green';
    btnStart.disabled = true;
    btnStop.disabled = false;
  }
  else {
    badge.textContent = 'STOPPED';
    badge.className = 'badge badge-red';
    btnStart.disabled = false;
    btnStop.disabled = true;
  }
}

export async function adminMount() {
  // Initial status fetch
  const status = await refreshPlcStatus();
  const alarmList = document.getElementById('alarm-list');
  updateUIFromStatus(status);

  document.getElementById('btn-start').addEventListener('click', async () => {
    await sendPlcCommand('start');
    const status = await refreshPlcStatus();
    updateUIFromStatus(status);
  });

  document.getElementById('btn-stop').addEventListener('click', async () => {
    await sendPlcCommand('stop');
    const status = await refreshPlcStatus();
    updateUIFromStatus(status);
  });

  document.getElementById('btn-write').addEventListener('click', () => {
    const tag = document.getElementById('write-tag').value;
    const value = parseInt(document.getElementById('write-value').value);
    sendPlcCommand('write', { tag, value });
  });

  async function loadAlarms() {
    const res = await fetch('/api/alarms', {
      credentials: 'same-origin'
    });

    if (!res.ok) {
      console.warn('Alarm fetch failed:', res.status);
      alarmList.innerHTML = '<li>No alarm access</li>';
      return;
    }

    const alarms = await res.json();

    if (!Array.isArray(alarms)) {
      console.warn('Alarm response not array:', alarms);
      return;
    }

    alarmList.innerHTML = alarms
      .slice()
      .reverse()
      .map(a => `
        <li class="alarm ${a.severity.toLowerCase()}">
          <strong>${a.code}</strong>
          <span>${a.message}</span>
          <small>${new Date(a.time).toLocaleTimeString()}</small>
        </li>
      `)
      .join('');
  }

  await loadAlarms();
  alarmTimer = setInterval(loadAlarms, 2000);
}

export function adminUnmount() {
  if (alarmTimer) clearInterval(alarmTimer);
}
