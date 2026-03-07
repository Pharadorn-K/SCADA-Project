# SCADA project
## Project structure :
```bash
scada-project/ 
│ 
├── .vscode/ 
│   └── settings.json
├── backend/ 
│   ├── python/ 
│   │   ├── __pycache__/
│   │   ├── __init__.py 
│   │   ├── plc_loop.py              
│   │   ├── plc_service.py               
│   │   └── utils/
│   │       ├── __pycache__/
│   │       ├── clean_data.py
│   │       ├── db_connector.py
│   │       └── db_writer.py                  
│   └── node/ 
│       ├── .env
│       ├── package.json 
│       ├── package-lock.json    
│       ├── server.js
│       ├── data/ 
│       │   └── systemState.json
│       ├── logs/ 
│       │   └── scada.log
│       ├── middleware/ 
│       │   └── requireRole.js                                      
│       ├── node_modules/ ...
│       ├── routes/ 
│       │   ├── api/                    
│       │   │   ├── alam.js
│       │   │   ├── alamHistory.js   
│       │   │   ├── audit.js   
│       │   │   ├── auth.js              
│       │   │   └── plc.js  
│       │   ├── shiftHistory.js  
│       │   └── shiftSummary.js  
│       └── services/ 
│           ├── alarmService.js
│           ├── bootstrapEngine.js
│           ├── db.js
│           ├── logService.js
│           ├── persistenceEngine.js 
│           ├── plcEngine.js
│           ├── plcMonitor.js 
│           ├── pythonBridge.js
│           ├── shiftEngine.js     
│           └── stateStore.js         
│ 
├── frontend/ 
│   ├── public/                        
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── css/
│   │   │   ├── fontawesome/
│   │   │   ├── webfonts/
│   │   │   ├── header_press.png
│   │   │   └── main.css
│   │   ├── images/
│   │   │   ├── Availability.png
│   │   │   ├── Availability2.png
│   │   │   ├── Performance.png
│   │   │   ├── OEE.png
│   │   │   ├── heat_DKK1.png
│   │   │   ├── heat_DKK2.png
│   │   │   ├── heat_K3.png
│   │   │   ├── heat_K4.png
│   │   │   ├── heat_K5.png
│   │   │   ├── heat_K6.png
│   │   │   ├── heat_K7.png
│   │   │   ├── heat_K8.png
│   │   │   ├── lathe_Rotor TK1.png
│   │   │   ├── lathe_Rotor TK4.png
│   │   │   ├── press_AIDA630T.png
│   │   │   └── press_M-20id-25.png
│   │   └── js/
│   │       ├── api.js
│   │       ├── app.js
│   │       ├── routes.js
│   │       ├── shiftSummary.js
│   │       ├── sidebar-behavior.js
│   │       ├── sidebar.js
│   │       ├── store.js
│   │       ├── storeSelectors.js
│   │       ├── utils.js
│   │       └── views/
│   │           ├── admin.js            
│   │           ├── home.js
│   │           ├── maintenance.js
│   │           └── production.js
│   └── src/                            
│       ├── main.js                     
│       ├── dashboard.js                
│       ├── api.js                      
│       └── styles/ 
│           └── main.css 
│
├── database/ 
│   ├── migrations/                     
│   ├── schema.sql                      
│   └── seed.sql                        
│ 
├── scripts/ 
│   ├── start-dev.sh                    
│   └── deploy.sh
│ 
├── .gitignore 
├── README.md 
└── docker-compose.yml                  
```

## Backend
### server.js
```javaScript
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
const shiftHistoryRoute = require('./routes/shiftHistory');
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
app.use('/api/shift-history', shiftHistoryRoute);
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

```

### .env
```bash
# backend/node/.env
PLC_IP="10.207.1.24"
PLC_PORT_A=5010
PLC_PORT_B=5011
PLC_PORT_C=5012
TCP_HOST="127.0.0.1"
TCP_PORT=8081

DB_HOST=10.207.1.87
DB_PORT=3306
DB_USER=PCSET123
DB_PASSWORD=123456
DB_NAME=scada
DB_MIN=1
DB_MAX=8

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

```

### requireRole.js
```javaScript
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

```

### alarmService.js
```javaScript
// backend/node/services/alarmService.js
const alarms = [];
let lastAlarmCode = null;

function raise(code, message, severity = 'ERROR') {
  if (code === lastAlarmCode) return;

  const alarm = {
    id: Date.now(),
    time: new Date().toISOString(),
    code,
    message,
    severity,
    acknowledged: false,
    ackBy: null,
    ackTime: null,
    cleared: false,
    clearTime: null
  };

  alarms.push(alarm);
  lastAlarmCode = code;

  console.log(`🚨 [${severity}] ${code} - ${message}`);

  broadcastAlarm('RAISED', alarm);

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

function broadcastAlarm(event, alarm) {
  const wss = global.services?.wss;
  if (!wss) return;

  const payload = JSON.stringify({
    type: 'alarm_event',
    event,   // RAISED | CLEARED | ACK
    alarm
  });

  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

function acknowledge(id, user) {
  const alarm = alarms.find(a => a.id === id);
  if (!alarm || alarm.acknowledged) return false;

  alarm.acknowledged = true;
  alarm.ackBy = user;
  alarm.ackTime = new Date().toISOString();
  broadcastAlarm('ACK', alarm);

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
  broadcastAlarm('CLEARED', alarm);

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

```

### bootstrapEngine.js
```javaScript
// backend/node/services/bootstrapEngine.js
const { getDbPool } = require('./db');
const plcEngine = require('./plcEngine');

function normalizeRow(row) {
  return {
    department: row.department,
    machine: row.machine,
    machine_type: row.machine_type,
    timestamp: row.timestamp,

    context: {
      part_name: row.part_name ?? '',
      plan: row.plan ?? 0,
      operator_id: row.operator_id ?? ''
    },

    metrics: {
      run: row.run ?? 0,
      idle: row.idle ?? 0,
      alarm: row.alarm ?? 0,
      offline: row.offline ?? 0,
      alarm_code: row.alarm_code ?? 0,
      cycle_time: row.cycle_time ?? 0,
      count_shift: row.count_shift ?? 0,
      count_signal: row.count_signal ?? 0,
      heat: row.heat ?? 0,
      setting: row.setting ?? 0
    }
  };
}

async function hydrate() {
  const pool = await getDbPool();

  const tables = ['raw_press', 'raw_heat', 'raw_lathe'];

  for (const table of tables) {

    console.log(`🔄 Hydrating from ${table}...`);

    const [machines] = await pool.query(
      `SELECT DISTINCT machine FROM ${table}`
    );

    for (const m of machines) {

      const [rows] = await pool.query(
        `
        SELECT *
        FROM ${table}
        WHERE machine = ?
        ORDER BY id_row DESC
        LIMIT 1
        `,
        [m.machine]
      );

      if (!rows.length) continue;

      const normalized = normalizeRow(rows[0]);
      // 🔥 1️⃣ Get current shift info
      const shiftEngine = require('./shiftEngine');
      const shiftInfo = shiftEngine.getShiftInfo(Date.now());

      // 🔥 2️⃣ Load saved shift durations
      const [shiftRows] = await pool.query(
        `
        SELECT run_seconds, idle_seconds,
              alarm_seconds, offline_seconds
        FROM machine_shift_status
        WHERE date = ?
          AND shift = ?
          AND department = ?
          AND machine = ?
        LIMIT 1
        `,
        [
          shiftInfo.date,
          shiftInfo.shift,
          normalized.department,
          normalized.machine
        ]
      );

      if (shiftRows.length) {
        normalized.shiftDurations = {
          run_seconds: shiftRows[0].run_seconds,
          idle_seconds: shiftRows[0].idle_seconds,
          alarm_seconds: shiftRows[0].alarm_seconds,
          offline_seconds: shiftRows[0].offline_seconds
        };
      } else {
        normalized.shiftDurations = {
          run_seconds: 0,
          idle_seconds: 0,
          alarm_seconds: 0,
          offline_seconds: 0
        };
      }
      // 🔥 IMPORTANT: use plcEngine only
      plcEngine.processUpdate(normalized);
    }
  }

  console.log('✅ Hydration complete (clean architecture)');
}

module.exports = { hydrate };
```

### db.js
```javaScript
// backend/node/services/db.js
const mysql = require('mysql2/promise');

let dbPool = null;

async function getDbPool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || '10.207.1.87',
      user: process.env.DB_USER || 'PESET123',
      password: process.env.DB_PASS || '123456',
      database: process.env.DB_NAME || 'scada',
      waitForConnections: true,
      connectionLimit: 5
    });
  }
  return dbPool;
}

module.exports = { getDbPool };
```

### logService.js
```javaScript
// backend/node/services/logService.js
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'scada.log');

const logs = []; // ✅ in-memory cache

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/* ---------- WRITE ---------- */

function writeLog(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('❌ Log write failed', err);
  });
}

/* ---------- PUBLIC API ---------- */

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
  const entry = {
    ts: new Date().toISOString(),
    type,
    severity,
    user,
    role,
    action,
    code,
    message,
    meta
  };

  logs.push(entry);
  writeLog(entry);
}

function getRecent({ type, limit = 100, from = null, to = null }) {
  let result = logs.filter(l => l.type === type);

  if (from) {
    const fromTs = new Date(from).getTime();
    result = result.filter(l => new Date(l.ts).getTime() >= fromTs);
  }

  if (to) {
    const toTs = new Date(to).getTime();
    result = result.filter(l => new Date(l.ts).getTime() <= toTs);
  }

  return result.slice(-limit);
}


/* ---------- WARM START ---------- */

function loadFromFile(limit = 10) {
  if (!fs.existsSync(LOG_FILE)) return;

  const lines = fs.readFileSync(LOG_FILE, 'utf8')
    .trim()
    .split('\n')
    .slice(-1000); // read a safe window

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'ALARM') {
        logs.push(entry);
      }
    } catch {
      /* ignore corrupted lines */
    }
  }

  // keep memory bounded
  while (logs.length > limit) logs.shift();

  console.log(`📜 Loaded ${logs.length} alarm(s) from history`);
}

module.exports = { log, getRecent, loadFromFile };

```

### persistenceEngine.js
```javaScript
// backend/node/services/persistenceEngine.js
const stateStore = require('./stateStore');
const { getDbPool } = require('./db');

async function saveAllShifts() {

  const pool = await getDbPool();
  const machines = stateStore.getPlcSnapshot().machines;

  for (const [key, machine] of Object.entries(machines)) {

    if (!machine.shiftDurations) continue;

    await pool.query(
      `
      INSERT INTO machine_shift_status
      (date, shift, department, machine,
       run_seconds, idle_seconds,
       alarm_seconds, offline_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        run_seconds = VALUES(run_seconds),
        idle_seconds = VALUES(idle_seconds),
        alarm_seconds = VALUES(alarm_seconds),
        offline_seconds = VALUES(offline_seconds)
      `,
      [
        machine.shiftDate,
        machine.shift,
        machine.department,
        machine.machine,
        machine.shiftDurations.run_seconds,
        machine.shiftDurations.idle_seconds,
        machine.shiftDurations.alarm_seconds,
        machine.shiftDurations.offline_seconds
      ]
    );
  }
}

function startAutoSave() {
  setInterval(saveAllShifts, 60 * 1000);
}

async function saveMachineShift(machine) {
  const {
    shiftDate,
    shift,
    department,
    machine: machineName,
    shiftDurations,
    availability
  } = machine;

  await pool.query(`
    INSERT INTO machine_shift_status
    (date, shift, department, machine,
     run_seconds, idle_seconds, alarm_seconds, offline_seconds,
     availability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      run_seconds = VALUES(run_seconds),
      idle_seconds = VALUES(idle_seconds),
      alarm_seconds = VALUES(alarm_seconds),
      offline_seconds = VALUES(offline_seconds),
      availability = VALUES(availability)
  `, [
    shiftDate,
    shift,
    department,
    machineName,
    shiftDurations.run_seconds,
    shiftDurations.idle_seconds,
    shiftDurations.alarm_seconds,
    shiftDurations.offline_seconds,
    availability ?? null
  ]);
}
function accumulateCurrentStatus(machine) {
  const now = Date.now();
  const diff = Math.floor((now - machine.statusStartedAt) / 1000);

  const bucketMap = {
    RUNNING: 'run_seconds',
    IDLE: 'idle_seconds',
    ALARM: 'alarm_seconds',
    OFFLINE: 'offline_seconds'
  };

  const bucket = bucketMap[machine.status];
  if (bucket) {
    machine.shiftDurations[bucket] += diff;
  }

  machine.statusStartedAt = now;
}

function scheduleNextShiftCheck() {
  const now = new Date();
  const next = calculateNextShiftBoundary(now);

  const delay = next.getTime() - now.getTime();

  setTimeout(() => {
    processShiftBoundary();
    scheduleNextShiftCheck();
  }, delay);
}

function startDurationTicker() {
  setInterval(() => {

    const machines = stateStore.getPlcSnapshot().machines;

    for (const machine of Object.values(machines)) {

      if (!machine.status || !machine.shiftDurations) continue;

      const bucketMap = {
        RUNNING: 'run_seconds',
        IDLE: 'idle_seconds',
        ALARM: 'alarm_seconds',
        OFFLINE: 'offline_seconds'
      };

      const bucket = bucketMap[machine.status];
      if (!bucket) continue;

      machine.shiftDurations[bucket] += 1;
    }

  }, 1000);
}
module.exports = {
  saveMachineShift,
  accumulateCurrentStatus,
  scheduleNextShiftCheck,
  startAutoSave,
  startDurationTicker
};

```

### plcEngine.js
```javaScript
// backend/node/services/plcEngine.js
const stateStore = require('./stateStore');
const shiftEngine = require('./shiftEngine');


function processUpdate(payload) {

  const { department, machine, metrics = {}, context = {}, timestamp } = payload;

  const key = `${department.toLowerCase()}_${machine}`;
  const machineState = stateStore.getPlc(key) || {};
  
  const now = Date.now();

  const newStatus = stateStore.deriveStatus(department, metrics);

  let durations =
    payload.shiftDurations ||
    machineState.shiftDurations || {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };


  const shiftInfo = shiftEngine.getShiftInfo(now);

  const updated = {
    department,
    machine,
    machineType: payload.machine_type,
    status: newStatus,
    statusStartedAt: machineState.status !== newStatus
      ? now
      : machineState.statusStartedAt || now,
    shift: shiftInfo.shift,
    shiftDate: shiftInfo.date,
    shiftDurations: durations,
    timestamp: new Date(timestamp).getTime(),
    lastUpdate: now,
    context,
    tags: metrics
  };

  stateStore.updatePlcBase(key, updated);

  shiftEngine.detectAndHandleShift(key);
}

module.exports = { processUpdate };
```

### plcMonitor.js
```javaScript
// backend/node/services/plcMonitor.js
const WebSocket = require('ws');

let wss = null;

function setWss(server) {
  wss = server;

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'plc_snapshot',
      payload: global.services.stateStore.getPlcSnapshot()
    }));
  });
}

function broadcast(type, payload) {
  if (!wss) return;

  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

module.exports = { setWss, broadcast };

```

### pythonBridge.js
```javaScript
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
```

### shiftEngine.js
```javaScript
// backend/node/services/shiftEngine.js

const stateStore = require('./stateStore');
const persistenceEngine = require('./persistenceEngine');

function getShiftInfo(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  let shift;

  if (hour >= 6 && hour < 14) shift = 'A';
  else if (hour >= 14 && hour < 22) shift = 'B';
  else shift = 'C';

  let shiftDate = new Date(date);

  // Shift C before 06:00 belongs to previous day
  if (shift === 'C' && hour < 6) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return {
    shift,
    date: shiftDate.toISOString().slice(0, 10)
  };
}

function getNextShiftBoundary(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  const hour = now.getHours();

  if (hour < 6) next.setHours(6, 0, 0, 0);
  else if (hour < 14) next.setHours(14, 0, 0, 0);
  else if (hour < 22) next.setHours(22, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }

  return next;
}

function calculateAvailability(d) {
  const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds;

  if (planned === 0) return 0;

  return d.run_seconds / planned;
}

async function closeShiftForMachine(machine) {

  const durations = machine.shiftDurations;

  const availability = calculateAvailability(durations);

  await persistenceEngine.saveMachineShift({
    ...machine,
    availability
  });
}

async function openNewShiftForMachine(machine, now) {

  const shiftInfo = getShiftInfo(now);

  machine.shift = shiftInfo.shift;
  machine.shiftDate = shiftInfo.date;

  machine.shiftDurations = {
    run_seconds: 0,
    idle_seconds: 0,
    alarm_seconds: 0,
    offline_seconds: 0
  };

  machine.statusStartedAt = now;

  // create new zero row immediately
  await persistenceEngine.saveMachineShift({
    ...machine,
    availability: 0
  });
}

async function processShiftBoundary() {

  console.log("🔄 SHIFT BOUNDARY TRIGGERED");

  const machines = stateStore.getPlcSnapshot().machines;
  const now = Date.now();

  for (const machine of Object.values(machines)) {

    // 1️⃣ Close old shift
    await closeShiftForMachine(machine);

    // 2️⃣ Open new shift
    await openNewShiftForMachine(machine, now);
  }

  console.log("✅ New shift initialized");

  const snapshot = stateStore.getPlcSnapshot();

  global.services.plcMonitor.broadcast({
    type: 'plc_snapshot',
    payload: snapshot
  });
}

function scheduleShiftBoundary() {
  const now = new Date();
  const next = getNextShiftBoundary(now);
  const delay = next.getTime() - now.getTime();

  console.log("⏳ Next shift boundary at:", next);

  setTimeout(async () => {
    await processShiftBoundary();
    scheduleShiftBoundary();
  }, delay);
}

// Fallback if PLC event triggers shift mismatch
async function detectAndHandleShift(key) {

  const machine = stateStore.getPlc(key);
  if (!machine) return;

  const now = Date.now();
  const shiftInfo = getShiftInfo(now);

  if (
    machine.shift !== shiftInfo.shift ||
    machine.shiftDate !== shiftInfo.date
  ) {

    await closeShiftForMachine(machine);
    await openNewShiftForMachine(machine, now);
  }
}

module.exports = {
  detectAndHandleShift,
  scheduleShiftBoundary,
  getShiftInfo
};
```

### stateStore.js
```javaScript
// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, '../data/systemState.json');


let runtimeState = {
  plc: {},          // 👈 LIVE PLC DATA
  meta: {
    lastIntent: 'STOPPED'
  }
};

/* ------------------ PLC STATE ------------------ */
function deriveStatus(department, metrics = {}) {
  // 1️⃣ Explicit offline
  if (metrics.offline === 1) return 'OFFLINE';

  const noSignal =
    !metrics.run &&
    !metrics.idle &&
    !metrics.alarm &&
    !metrics.setting &&
    !metrics.heat;

  if (noSignal) return 'OFFLINE';

  // 2️⃣ Alarm priority
  if (metrics.alarm === 1) return 'ALARM';

  // 3️⃣ Department-specific logic
  if (department?.toLowerCase() === 'heat') {
    // Heat rule:
    if (metrics.run === 1 || metrics.heat === 1) {
      return 'RUNNING';
    }

    if (
      metrics.run === 0 &&
      metrics.heat === 0 &&
      metrics.idle === 1
    ) {
      return 'IDLE';
    }

    return 'STOP';
  }

  // 4️⃣ Default logic (Press, Lathe, etc.)
  if (metrics.run === 1) return 'RUNNING';
  if (metrics.idle === 1) return 'IDLE';

  return 'STOP';
}

function updatePlcBase(key, data) {
  runtimeState.plc[key] = {
    ...runtimeState.plc[key],
    ...data
  };
}

function getPlcSnapshot() {
  return {
    timestamp: Date.now(),
    machines: { ...runtimeState.plc }
  };
}

function getPlc(key) {
  return runtimeState.plc[key] || null;
}

/* ------------------ SYSTEM STATE ------------------ */
function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return runtimeState.meta;
    runtimeState.meta = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return runtimeState.meta;
  } catch {
    return runtimeState.meta;
  }
}

function saveState(state) {
  runtimeState.meta = { ...runtimeState.meta, ...state };
  fs.writeFileSync(STATE_FILE, JSON.stringify(runtimeState.meta, null, 2));
}


module.exports = {
  deriveStatus,
  updatePlcBase,
  getPlcSnapshot,
  getPlc,
  loadState,
  saveState,
};

```

### shiftHistory.js
```javaScript
// backend/node/routes/shiftHistory.js
const express = require('express');
const router = express.Router();
const { getDbPool } = require('../services/db');

router.get('/', async (req, res) => {

  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date required' });
    }

    const sql = `
      SELECT
        shift,
        department,
        run_seconds,
        idle_seconds,
        alarm_seconds
      FROM machine_shift_status
      WHERE date = ?
      ORDER BY shift, department
    `;
    const pool = await getDbPool();
    const [rows] = await pool.query(sql, [date]);

    // 🔥 group by shift + department
    const shifts = {};

    rows.forEach(r => {

      if (!shifts[r.shift]) {
        shifts[r.shift] = {};
      }

      if (!shifts[r.shift][r.department]) {
        shifts[r.shift][r.department] = {
          run: 0,
          idle: 0,
          alarm: 0
        };
      }

      shifts[r.shift][r.department].run += r.run_seconds;
      shifts[r.shift][r.department].idle += r.idle_seconds;
      shifts[r.shift][r.department].alarm += r.alarm_seconds;
    });

    // 🔥 calculate availability per shift + department
    const result = Object.entries(shifts).map(([shift, departments]) => {

      const deptSummary = Object.entries(departments).map(([dept, d]) => {

        const planned = d.run + d.idle + d.alarm;
        const availability = planned > 0 ? d.run / planned : 0;

        return {
          department: dept,
          availability
        };
      });

      return {
        shift,
        departments: deptSummary
      };
    });

    res.json({ success: true, data: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
```

### shiftSummary.js
```javaScript
// backend/node/routes/shiftSummary.js
const express = require('express');
const router = express.Router();
const { getDbPool } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const { date, shift } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    let sql = `
      SELECT
        department,
        machine,
        run_seconds,
        idle_seconds,
        alarm_seconds,
        offline_seconds,
        availability
      FROM machine_shift_status
      WHERE date = ?
    `;

    const params = [date];

    if (shift) {
      sql += ' AND shift = ?';
      params.push(shift);
    }
    const pool = await getDbPool();
    const [rows] = await pool.query(sql, params);

    // 🔥 Build department summary
    const departments = {};

    rows.forEach(r => {

      if (!departments[r.department]) {
        departments[r.department] = {
          run: 0,
          idle: 0,
          alarm: 0,
          machines: []
        };
      }

      departments[r.department].run += r.run_seconds;
      departments[r.department].idle += r.idle_seconds;
      departments[r.department].alarm += r.alarm_seconds;

      departments[r.department].machines.push({
        ...r,
        availability: Number(r.availability)
      });
    });

    // 🔥 Compute department availability
    const departmentSummary = Object.entries(departments).map(([dept, d]) => {

      const planned = d.run + d.idle + d.alarm;
      const availability = planned > 0 ? d.run / planned : 0;

      return {
        department: dept,
        availability,
        machines: d.machines
      };
    });

    // 🔥 Compute total factory availability
    let totalRun = 0;
    let totalIdle = 0;
    let totalAlarm = 0;

    rows.forEach(r => {
      totalRun += r.run_seconds;
      totalIdle += r.idle_seconds;
      totalAlarm += r.alarm_seconds;
    });

    const totalPlanned = totalRun + totalIdle + totalAlarm;
    const totalAvailability =
      totalPlanned > 0 ? totalRun / totalPlanned : 0;

    res.json({
      success: true,
      departments: departmentSummary,
      totalAvailability
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
```

### alarm.js
```javaScript
// backend/node/routes/api/alarm.js
const express = require('express');
const router = express.Router();

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
```

### alarmHistory.js
```javaScript
// backend/node/routes/api/alarmHistory.js
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/requireRole');

router.get('/', requireRole('admin'), (req, res) => {
  const { from, to, limit } = req.query;

  const logs = global.services.logService.getRecent({
    type: 'ALARM',
    from,
    to,
    limit: Number(limit) || 10
  });

  res.json(logs);
});


module.exports = router;

```

### audit.js
```javaScript
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

```

### auth.js
```javaScript
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
  // ✅ Capture data BEFORE destroy
  const userId = req.session?.userId || 'unknown';
  const role = req.session?.role || 'unknown';

  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ success: false });
    }

    // ✅ Log AFTER destroy using captured values
    global.services.logService.log({
      type: 'AUDIT',
      severity: 'INFO',
      user: userId,
      role: role,
      action: 'LOGOUT',
      message: 'User logged out'
    });

    res.json({ success: true });
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
```

### plc.js
```javaScript
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
```

### plc_service.py
```python
# backend/python/plc_service.py
import socket
import threading
import json
import sys
from datetime import datetime
from dotenv import load_dotenv
import os
try:
    # Use package relative import when this module is part of a package
    from . import plc_loop
except Exception:
    # Fallback to top-level import when running as a script: python plc_service.py
    try:
        import plc_loop
    except Exception:
        # As a last resort, try to adjust path and import
        import os
        sys.path.insert(0, os.path.dirname(__file__))
        import plc_loop
# At top of plc_service.py
load_dotenv(dotenv_path="../node/.env")

PLC_IP = os.getenv("PLC_IP")
PLC_PORT_A = int(os.getenv('PLC_PORT_A'))
PLC_PORT_B = int(os.getenv('PLC_PORT_B'))
PLC_PORT_C = int(os.getenv('PLC_PORT_C'))

TCP_HOST = os.getenv("TCP_HOST")
TCP_PORT = int(os.getenv("TCP_PORT"))
# READ_CONFIG = ["B0", 7168, "W0", 960]  # [bit_head, bit_size, word_head, word_size]

READ_CONFIG = [
    os.getenv("BIT_HEAD"),
    int(os.getenv('BIT_SIZE')), 
    os.getenv("WORD_HEAD_A"), 
    os.getenv("WORD_HEAD_B"), 
    os.getenv("WORD_HEAD_C"),
    os.getenv("WORD_HEAD_D"),
    os.getenv("WORD_HEAD_E"),
    os.getenv("WORD_HEAD_F"),
    os.getenv("WORD_HEAD_G"),
    int(os.getenv("WORD_SIZE"))
    ]
# List of connected Node.js clients (socket, address)
connected_clients = []

def handle_client(client_socket, addr):
    """Handle a single Node.js client connection."""
    print(f"📥 New connection from {addr}")
    connected_clients.append((client_socket, addr))

    try:
        buffer = ""
        while True:
            data = client_socket.recv(1024)
            if not data:
                break
            buffer += data.decode('utf-8')

            # Handle line-by-line JSON messages (split by \n)
            while '\n' in buffer:
                line, buffer = buffer.split('\n', 1)
                line = line.strip()
                if not line:
                    continue

                try:
                    msg = json.loads(line)
                    handle_command(msg, client_socket)
                except json.JSONDecodeError as e:
                    print(f"❌ Invalid JSON from {addr}: {line} | Error: {e}")
    except ConnectionResetError:
        pass
    except Exception as e:
        print(f"⚠️ Client {addr} error: {e}")
    finally:
        print(f"📤 Client {addr} disconnected")
        if (client_socket, addr) in connected_clients:
            connected_clients.remove((client_socket, addr))
        client_socket.close()


def handle_command(msg, client_socket):
    """Process commands from Node.js."""
    cmd = msg.get("cmd")

    if cmd == "start":
        print("▶️ Start command received")
        success = plc_loop.start_loop(
            plc_location=(PLC_IP, PLC_PORT_A, PLC_PORT_B, PLC_PORT_C),
            read_config=READ_CONFIG,
            socket_clients_list=connected_clients,
        )
        # Send ACK back
        response = {"type": "ack", "cmd": "start", "success": success}
        client_socket.send((json.dumps(response) + "\n").encode('utf-8'))

    elif cmd == "stop":
        print("⏹️ Stop command received")
        plc_loop.stop_loop()
        # Send ACK back
        response = {"type": "ack", "cmd": "stop", "success": True}
        client_socket.send((json.dumps(response) + "\n").encode('utf-8'))

    elif cmd == "write":
        tag = msg.get("tag")
        value = msg.get("value")
        if tag is None or value is None:
            print("❌ Write command missing 'tag' or 'value'")
            return
        print(f"📝 Write command: {tag} = {value}")
        plc_loop.write_tag(tag, value)
        # After successful write
        response = {"type": "ack", "cmd": "write", "tag": tag, "success": True}
        client_socket.send((json.dumps(response) + "\n").encode('utf-8'))
    else:
        print(f"❓ Unknown command: {cmd}")


def start_tcp_server():
    """Start the TCP command server."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server.bind((TCP_HOST, TCP_PORT))
        server.listen(5)
        print(f"📡 Python PLC service listening on {TCP_HOST}:{TCP_PORT}")
    except OSError as e:
        print(f"❌ Failed to bind to {TCP_HOST}:{TCP_PORT}: {e}")
        sys.exit(1)

    try:
        while True:
            client_sock, addr = server.accept()
            client_handler = threading.Thread(
                target=handle_client,
                args=(client_sock, addr),
                daemon=True
            )
            client_handler.start()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down PLC service...")
    finally:
        plc_loop.stop_loop()
        server.close()


if __name__ == "__main__":
    print(f"🚀 Starting SCADA PLC Service | {datetime.now().isoformat()}")
    start_tcp_server()
```

### plc_loop.py
```python
# backend/python/plc_loop.py
import pymcprotocol
import time
import threading
from datetime import datetime
from queue import Full, Queue, Empty
import sys
import time
import json

try:
    # Prefer relative import when running as a package
    from .utils import db_writer
    from .utils import clean_data
    from .utils import db_connector
except Exception:
    # Fall back to direct import when running as a script
    from utils import db_writer
    from utils import clean_data
    from utils import db_connector

# Global state (consider encapsulating in a class later if needed)
_command_queue = Queue()  # Thread-safe queue for write commands
mc = None
_running = False
_plc_location = None
_read_config = None
_socket_clients = []  # List of (socket, addr) to broadcast to
raw_bit_data = []
raw_word_data = []
_stop_event = threading.Event()
STOP = object()
WORKER_DONE = object()
TOTAL_WORKERS = 3  # press, heat, lathe
finished_workers = 0

main_q_intersection = Queue(maxsize=5000)
press_clean_q = Queue(maxsize=1000)
heat_clean_q = Queue(maxsize=1000)
lathe_clean_q = Queue(maxsize=1000)
eq_press_clean_q = Queue(maxsize=1000)
clean_db_q = Queue(maxsize=1000)
broadcast_q = Queue(maxsize=1000)


# Python sends heartbeat
def send_heartbeat(socket):
    msg = {
        "type": "heartbeat",
        "ts": time.time()
    }
    socket.sendall((json.dumps(msg) + "\n").encode())

_db_pool = None
_db_pool = db_connector.create_pool()
plc_location = clean_data.get_all_location(_db_pool,"PLC")
status_location = clean_data.get_all_location(_db_pool,"Read_location")
all_range = clean_data.get_all_location(_db_pool,"All")
# all_range_equipment = clean_data.get_all_location(_db_pool,"Equipment")
all_department,all_machine,all_data,all_category = clean_data.get_range(all_range)
# all_department_eq,all_machine_eq,all_category_eq,all_data_eq = clean_data.get_range_equipment(all_range_equipment)
# --- Get connection pool ---
def get_db_pool():
    global _db_pool
    if _db_pool is None:
        _db_pool = db_connector.create_pool()
    return _db_pool

def connect_to_plc():
    """
    Attempt to connect to PLC with fallback ports.
    
    Returns:
        bool: True if connection successful, False otherwise
    """
    global mc
    
    # Close existing connection
    if mc is not None:
        try:
            mc.close()
        except Exception:
            pass
    
    # Try each port in the location config
    ports_to_try = _plc_location[1:4]  # indices 1, 2, 3
    
    for port in ports_to_try:
        try:
            mc = pymcprotocol.Type3E()
            mc.connect(_plc_location[0], port)
            print(f"✅ Connected to PLC {_plc_location[0]}:{port}")
            return True
        except Exception as e:
            print(f"⚠️ Connection attempt to port {port} failed: {e}")
            continue
    
    # All connection attempts failed
    print(f"❌ Failed to connect to PLC after trying ports: {ports_to_try}")
    mc = None
    return False

def start_loop(plc_location, read_config, socket_clients_list):
    """
    Start the PLC polling loop in a background thread.
    Called by plc_service.py
    """
    global _running, _plc_location, _read_config, _socket_clients, press_clean_q, heat_clean_q, lathe_clean_q, eq_press_clean_q, clean_db_q,broadcast_q,main_q_intersection,finished_workers,WORKER_DONE, STOP
    _plc_location = plc_location
    _read_config = read_config
    _socket_clients = socket_clients_list
    if _running:
        print("⚠️ PLC loop already running")
        return False
    
    _running = True
    _stop_event.clear()

    # Start background thread
    loop_read_PLC_thread = threading.Thread(target=_loop_read_plc_worker, daemon=True)
    loop_read_PLC_thread.start()
    
    loop_main_queue_thread = threading.Thread(target=_main_queue_intersection, daemon=True)
    loop_main_queue_thread.start()
    loop_press_clean_thread = threading.Thread(target=_loop_clean_press_data_worker, daemon=True)
    loop_press_clean_thread.start()
    loop_heat_clean_thread = threading.Thread(target=_loop_clean_heat_data_worker, daemon=True)
    loop_heat_clean_thread.start()
    loop_lathe_clean_thread = threading.Thread(target=_loop_clean_lathe_data_worker, daemon=True)
    loop_lathe_clean_thread.start()

    loop_broadcast_thread = threading.Thread(target=_loop_broadcast_worker,daemon=True)
    loop_broadcast_thread.start()

    loop_write_DB_thread = threading.Thread(target=_loop_writer_db_worker, daemon=True)
    loop_write_DB_thread.start()

    # loop_eq_press_clean_thread = threading.Thread(target=_loop_clean_eq_press_data_worker, daemon=True)
    # loop_eq_press_clean_thread.start()

    return True

def stop_loop():
    global _running
    print("🛑 Stop requested")
    _running = False
    _stop_event.set()
    time.sleep(1.5)  # allow threads to exit

    _stop_event.clear()

def write_tag(tag, value):
    """
    Enqueue a write command. Format: e.g., tag="B100", value=1
    Called from plc_service.py (TCP command handler)
    """
    # Use consistent keys for the queued command
    _command_queue.put({"tag": tag, "value": value})
    print(f"➕ Enqueued write command: {tag} = {value}")
def _process_write_commands():
    """Process all pending write commands."""
    while not _command_queue.empty():
        try:
            cmd = _command_queue.get_nowait()
            tag = cmd["tag"]
            value = cmd["value"]

            if mc is None:
                print("⚠️ Cannot write: PLC not connected")
                continue

            try:
                if tag.startswith("B") or tag.startswith("X") or tag.startswith("Y"):
                    # Bit write
                    device = tag[0]
                    offset = int(tag[1:])
                    mc.randomwrite_bitunits(
                        writedata=[value],
                        device=device,
                        headdevice=offset
                    )
                elif tag.startswith("W") or tag.startswith("D"):
                    # Word write
                    device = tag[0]
                    offset = int(tag[1:])
                    mc.randomwrite_wordunits(
                        writedata=[value],
                        device=device,
                        headdevice=offset
                    )
                else:
                    print(f"❓ Unknown tag format: {tag}")
                print(f"✍️ Wrote {tag} = {value}")
            except Exception as e:
                print(f"❌ Write error: {e}")
        except Empty:
            break

def _loop_read_plc_worker():
    """Main read loop."""
    global mc
    connected = False

    while _running and not _stop_event.is_set():
        if not connected:
            connected = connect_to_plc()
            if not connected:
                time.sleep(1)  # Retry every 5s if disconnected
                continue

        try:
            # Process any pending writes
            _process_write_commands()
            raw_bit_data.clear()
            raw_word_data.clear()
            
            # Read data
            bit_head, bit_size, word_head_a, word_head_b, word_head_c, word_head_d, word_head_e, word_head_f, word_head_g, word_size = _read_config
            word_head = (word_head_a, word_head_b, word_head_c, word_head_d, word_head_e, word_head_f, word_head_g)

            raw_bit_data.extend(mc.batchread_bitunits(headdevice=bit_head, readsize=bit_size))

            for wh in word_head:
                raw_word_data.extend(mc.batchread_wordunits(headdevice=wh, readsize=word_size))

            timestamp = datetime.now() #.isoformat()
            bit_data = raw_bit_data.copy()
            word_data = raw_word_data.copy()

            tags = (timestamp, bit_data, word_data)

            main_q_intersection.put(tags , timeout=1)

            for client_sock, addr in _socket_clients[:]:
                try:
                    send_heartbeat(client_sock)
                except Exception as e:
                    print(f"🔌 Heartbeat failed for {addr}: {e}")
            
            time.sleep(0.3)  # 0.3-second loop

        except Exception as e:
            print(f"⚠️ Read error, reconnecting: {e}")
            connected = False
            try:
                mc.close()
            except:
                pass
            mc = None
            time.sleep(0.3)

    # Cleanup on exit
    if mc:
        mc.close()
        print("🛑 PLC loop stopped")        
        main_q_intersection.put_nowait(STOP)
    else:
        print("🛑 PLC loop stopped, ⚠️ Error mc")

def _main_queue_intersection():
    while True:
        data = main_q_intersection.get()        
        try:
            if data is STOP:
                for sq in [press_clean_q, heat_clean_q, lathe_clean_q]: # , lathe_clean_q
                    sq.put_nowait(STOP)
                print("🛑 Main intersection finished, stopped By STOP")
                break

            for q in [press_clean_q, heat_clean_q, lathe_clean_q]:#, lathe_clean_q
                try:
                    q.put(data, timeout=1)
                except Full:
                    print(f"⚠️ Queue full {q}, drop data")
        finally:
            main_q_intersection.task_done()

def _loop_clean_press_data_worker():
    while True :
        data = press_clean_q.get() 
        try:
            if data is STOP:
                print("🛑 Press worker finished, stopped By STOP")                
                clean_db_q.put_nowait(WORKER_DONE)
                break
            clean_data.press_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q)
        finally:
            press_clean_q.task_done()

def _loop_clean_heat_data_worker():
    while True :
        data = heat_clean_q.get() 
        try:
            if data is STOP:
                print("🛑 Heat worker finished, stopped By STOP")                
                clean_db_q.put_nowait(WORKER_DONE)
                break
            clean_data.heat_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q)
        finally:
            heat_clean_q.task_done()

def _loop_clean_lathe_data_worker():
    while True :
        data = lathe_clean_q.get() 
        try:
            if data is STOP:
                print("🛑 Lathe worker finished, stopped By STOP")                
                clean_db_q.put_nowait(WORKER_DONE)
                break
            clean_data.lathe_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q)
        finally:
            lathe_clean_q.task_done()

def _loop_broadcast_worker():
    while True:
        payload = broadcast_q.get()
        try:
            if payload is STOP:
                print("🛑 Broadcast worker stopped")
                break
            _broadcast_to_node(payload)

        except Exception as e:
            print("📡 Broadcast error:", e)

        finally:
            broadcast_q.task_done()

def _broadcast_to_node(payload):
    message = json.dumps({
        "type": "plc_clean",
        "payload": payload
    }, default=str) + "\n"

    for client_sock, addr in _socket_clients[:]:
        try:
            client_sock.sendall(message.encode())
        except Exception:
            _socket_clients.remove((client_sock, addr))

def _loop_writer_db_worker():
    """Worker thread to write PLC data to DB."""
    global _db_pool, TOTAL_WORKERS, finished_workers
    while True:
        data = clean_db_q.get()
        if clean_db_q.qsize() > 10:
            print("Queue size:", clean_db_q.qsize())        
        try:
            if data is WORKER_DONE:
                finished_workers += 1
                print(f"🧩 Worker finished: {finished_workers}/{TOTAL_WORKERS}")

                if finished_workers == TOTAL_WORKERS:
                    print("🛑 All workers finished. DB writer stopped.")
                    break
                continue

            # Validate data structure early
            if not isinstance(data, dict):
                print(f"⚠️ Unexpected data type received: {type(data)}. Skipping.")
                continue

            if _db_pool is None:
                print("to write but _db_pool is None", _db_pool)
                _db_pool = get_db_pool()
                if _db_pool is None:
                    time.sleep(1)
                    print("⚠️ DB pool not available. Skipping save.")
                    continue  # Don't return—keep worker alive for next items
                else:
                    print("✅ recreated DB pool complete.")
            
            # ✅ CORRECTED: Access 'department' key from dict
            department = data.get('department')
            if department == "Press":
                success = db_writer.save_press_data(_db_pool, data)
            elif department == "Heat":
                success = db_writer.save_heat_data(_db_pool, data)
            elif department == "Lathe":
                success = db_writer.save_lathe_data(_db_pool, data)
            else:
                print(f"⚠️ Unknown department '{department}'. Skipping save.")
                success = False

            if not success:
                print("❌ Failed to save PLC data to DB")


        except Exception as e:
            print(f"💥 Unexpected error in DB writer: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            clean_db_q.task_done()

```

### clean_data.py
```python
# backend/python/utils/clean_data.py
import struct
from datetime import datetime, time, timedelta

def plc_received_to_string(received):
    try:
        for i in received:
            if i == -1:
                received.remove(i)
        byte_data = b''.join(struct.pack('<H', n) for n in received)
        # Decode as ASCII (or 'latin-1' to be safe with 0-255)
        result = byte_data.decode('ascii').rstrip(' \x00\t\r\n')
    except Exception as e:
        print("❌ PLC received to string error:",e)
        print(received)
    return result


def get_all_location(_db_pool,keys):
    conn = _db_pool.connection()
    cursor = conn.cursor()
    if keys == "PLC":
        query = """
            SELECT target_,range_
            FROM source_plc_location
            WHERE type_ = %s 
            ORDER BY id_row ASC
            """
    elif keys == "Read_location":
        query = """
            SELECT type_,target_,range_
            FROM source_plc_location
            WHERE note_ = %s
            ORDER BY id_row ASC
            """
    elif keys == "All":
        query = """
            SELECT type_,department_,machine_,target_,range_,note_
            FROM source_plc_location
            WHERE department_ <> %s AND note_ <> "Equipment"
            ORDER BY id_row ASC
            """
    elif keys == "Equipment":
        query = """ 
            SELECT category_,type_,department_,machine_,target_,range_,note_
            FROM source_plc_location
            WHERE note_ = %s
            ORDER BY id_row ASC           
            """
    cursor.execute(query,(keys,))
    location = cursor.fetchall()
    cursor.close()
    conn.close()
    return location
def get_range(all_range):
    all_department = list(dict.fromkeys(i["department_"] for i in all_range))
    if all_range[0]["note_"] == "Equipment":
        all_category = list(dict.fromkeys(i["category_"] for i in all_range)) 
    else:
        all_category = []
    all_data,all_machine = [],[]
    for department in all_department:
        group_data = []
        for range_ in range(len(all_range)):    
            if  department == all_range[range_]["department_"]:
                hex = (all_range[range_]["target_"][1:])
                dec = int(hex,16)
                all_range[range_]["target_"] = dec
                group_data.append(all_range[range_])
        list_machine = list(dict.fromkeys(i["machine_"] for i in group_data))
        all_machine.append(list_machine)
        all_data.append(group_data)
    return all_department,all_machine,all_data,all_category
def get_range_equipment(all_range_equipment):
    all_department = list(dict.fromkeys(i["department_"] for i in all_range_equipment))

    all_machine = []
    for department in range(len(all_department)):
        each_machine = []
        for data in range(len(all_range_equipment)):
            if all_range_equipment[data]["department_"] == all_department[department]:
                each_machine.append(all_range_equipment[data]["machine_"])
        filter_machine = list(dict.fromkeys(machine for machine in each_machine))
        all_machine.append(filter_machine)

    all_category = []
    all_data = []
    for department in range(len(all_department)):
        each_machine = []
        each_machine_data = []
        for machine in range(len(all_machine[department])):
            each_category = []
            each_category_data = []
            for data in range(len(all_range_equipment)):  
                if all_range_equipment[data]["department_"] == all_department[department] and all_range_equipment[data]["machine_"] == all_machine[department][machine]:
                    each_category.append(all_range_equipment[data]["category_"])
                    hex = (all_range_equipment[data]["target_"][1:])
                    dec = int(hex,16)
                    all_range_equipment[data]["target_"] = dec
                    each_category_data.append(all_range_equipment[data])
            each_machine.append(each_category)
            each_machine_data.append(each_category_data)
        all_category.append(each_machine)
        all_data.append(each_machine_data)

    return all_department,all_machine,all_category,all_data


# Filter process Press
compare_press_count,compare_press_status = [[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]]
compare_heat_count,compare_heat_status,compare_heat_time = [[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]]
skip_idle_check = [[],[],[],[],[],[],[],[],[],[],[],[],[]]
compare_lathe_count,compare_lathe_status = [[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]]
# Read all row after last output
def row_after_output(_db_pool,timestamp,department,machine_name,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT timestamp,count_signal,idle,alarm,offline
            FROM raw_press
            WHERE id_row >=(
                SELECT id_row
                FROM raw_press
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
        """
    elif department == "Heat":
        query = """
            SELECT timestamp,count_signal,idle,setting,alarm,offline
            FROM raw_heat
            WHERE id_row >=(
                SELECT id_row
                FROM raw_heat
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
        """ 
    elif department == "Lathe":
        query = """
            SELECT timestamp,count_signal,idle,alarm,offline
            FROM raw_lathe
            WHERE id_row >=(
                SELECT id_row
                FROM raw_lathe
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
        """  
    cursor = conn.cursor()
    cursor.execute(query,(timestamp,department,machine_name,part_name,1,timestamp,department,machine_name,part_name))
    row = cursor.fetchall()  
    cursor.close()
    conn.close()
    return row

# Count today production 
def count_production(_db_pool,timestamp,department,machine):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_press
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND count_signal = %s
        """
    elif department == "Heat":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_heat
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND count_signal = %s
        """
    elif department == "Lathe":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_lathe
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND count_signal = %s
        """
    cursor = conn.cursor()
    cursor.execute(query, (timestamp,department,machine,1))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result['count_output'] if result and 'count_output' in result else 0
def get_shift_range(current_dt):
    t = current_dt.time()

    shift_a_start = time(6, 0)
    shift_b_start = time(14, 0)
    shift_c_start = time(22, 0)

    if shift_a_start <= t < shift_b_start:
        shift = "A"
        start = current_dt.replace(hour=6, minute=0, second=0, microsecond=0)
        end = current_dt.replace(hour=14, minute=0, second=0, microsecond=0)

    elif shift_b_start <= t < shift_c_start:
        shift = "B"
        start = current_dt.replace(hour=14, minute=0, second=0, microsecond=0)
        end = current_dt.replace(hour=22, minute=0, second=0, microsecond=0)

    else:
        shift = "C"
        start = current_dt.replace(hour=22, minute=0, second=0, microsecond=0)

        # ถ้าเป็นหลังเที่ยงคืน ต้องย้อนวัน
        if t < shift_a_start:
            start = start - timedelta(days=1)

        end = start + timedelta(hours=8)

    return shift, start, end
def count_current_shift(_db_pool, timestamp, department, machine):
    conn = _db_pool.connection()
    # current_dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S.%f")

    shift, start_time, end_time = get_shift_range(timestamp)

    table_map = {
        "Press": "raw_press",
        "Heat": "raw_heat",
        "Lathe": "raw_lathe"
    }

    table_name = table_map.get(department)
    if not table_name:
        return 0

    query = f"""
        SELECT COUNT(count_signal) AS count_output
        FROM {table_name}
        WHERE timestamp >= %s
        AND timestamp < %s
        AND department = %s
        AND machine = %s
        AND count_signal = 1
    """

    cursor = conn.cursor()
    cursor.execute(query, (start_time, end_time, department, machine))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    return result['count_output'] if result else 0

def press_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [7,1,13,6,0]
    point_str = ["idle","alarm","offline"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data_range in (all_data[point_int[4]]):
                if data_range["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data_range["type_"])
                    if data_range["note_"] == "Part_Name":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Plan" :
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "Alarm_Code":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "ID_Operator":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Status":
                        pick_up = bit_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)    
        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_press_status[list_data]:
                    cycle_time = 0
                    count_shift = 0
                    compare_press_status[list_data] = status_check[point_int[1]:point_int[2]]
                    clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_press",
                        "department": "Press",
                        "machine": status_check[2],
                        "machine_type": status_check[3],
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "count_signal": status_check[7],
                            "run": status_check[8],
                            "idle": status_check[9],
                            "alarm": status_check[10],
                            "offline": status_check[11],
                            "alarm_code": status_check[12],
                            "cycle_time": cycle_time,
                            "count_shift": count_shift
                        }
                    })
                    broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_press",
                        "department": "Press",
                        "machine": status_check[2],
                        "machine_type": status_check[3],
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "count_signal": status_check[7],
                            "run": status_check[8],
                            "idle": status_check[9],
                            "alarm": status_check[10],
                            "offline": status_check[11],
                            "alarm_code": status_check[12],
                            # "cycle_time": cycle_time,
                            # "count_shift": count_shift
                        }
                    })
                else : 
                    pass
                
                status_count_check = machine_data[list_data].copy()
                count_check = status_count_check[point_int[0]]
                if count_check != 0:
                    if count_check != compare_press_count[list_data]:
                        old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
                        cycle_time = 0
                        if old_row == () or old_row == None:
                            cycle_time = point_int[3]
                        else:
                            for row in old_row:
                                if row[point_str[0]] == 1 or row[point_str[1]] == 1 or row[point_str[2]] == 1:
                                    cycle_time = point_int[3]
                                    break
                            if cycle_time != point_int[3]:
                                cycle_time = round((status_count_check[0] - old_row[0]["timestamp"]).total_seconds(), 2)
                                if cycle_time > point_int[3]*3:
                                    cycle_time = point_int[3]
                        count_shift = count_current_shift(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1                            
                        compare_press_count[list_data] = count_check
                        clean_db_q.put({
                            "event": "plc_clean",
                            "source": "clean_press",
                            "department": "Press",
                            "machine": status_count_check[2],
                            "machine_type": status_count_check[3],
                            "timestamp": status_count_check[0],

                            "context": {
                                "part_name": status_count_check[4],
                                "plan": status_count_check[5],
                                "operator_id": status_count_check[6],
                            },

                            "metrics": {
                                "count_signal": status_count_check[7],
                                "run": status_count_check[8],
                                "idle": status_count_check[9],
                                "alarm": status_count_check[10],
                                "offline": status_count_check[11],
                                "alarm_code": status_count_check[12],
                                "cycle_time": cycle_time,
                                "count_shift": count_shift
                            }
                        })
                        broadcast_q.put({
                            "event": "plc_clean",
                            "source": "clean_press",
                            "department": "Press",
                            "machine": status_count_check[2],
                            "machine_type": status_count_check[3],
                            "timestamp": status_count_check[0],

                            "context": {
                                "part_name": status_count_check[4],
                                "plan": status_count_check[5],
                                "operator_id": status_count_check[6],
                            },

                            "metrics": {
                                "count_signal": status_count_check[7],
                                "run": status_count_check[8],
                                "idle": status_count_check[9],
                                "alarm": status_count_check[10],
                                "offline": status_count_check[11],
                                "alarm_code": status_count_check[12],
                                "cycle_time": cycle_time,
                                "count_shift": count_shift
                            }
                        })
                    else : 
                        pass
                else :
                    compare_press_count[list_data] = count_check        
        else:
            pass
    except Exception as e:
        print("❌ Press clean data error:",e)
  
def heat_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [9,1,15,95,1]
    point_str = ["alarm","setting"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data_range in (all_data[point_int[4]]):
                if data_range["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data_range["type_"])
                    if data_range["note_"] == "Part_Name":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Plan" :
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "Alarm_Code":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "ID_Operator":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Status":
                        pick_up = bit_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)

        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_heat_status[list_data]:
                    cycle_time = 0
                    count_shift = 0
                    skip_idle_check[list_data] = 1
                    compare_heat_status[list_data] = status_check[point_int[1]:point_int[2]]
                    compare_heat_time[list_data] = status_check[0]         
                    clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_heat",
                        "department": "Heat",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "heat": status_check[8],
                            "count_signal": status_check[9],
                            "idle": status_check[10],
                            "setting": status_check[11],
                            "alarm": status_check[12],
                            "offline": status_check[13],
                            "alarm_code": status_check[14],
                            "cycle_time": cycle_time,
                            "count_shift": count_shift
                        }
                    })
                    broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_heat",
                        "department": "Heat",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "heat": status_check[8],
                            "count_signal": status_check[9],
                            "idle": status_check[10],
                            "setting": status_check[11],
                            "alarm": status_check[12],
                            "offline": status_check[13],
                            "alarm_code": status_check[14],
                            # "cycle_time": cycle_time,
                            # "count_shift": count_shift
                        }
                    })
                elif status_check[point_int[1]:point_int[2]] == compare_heat_status[list_data] and status_check[10] == 1:
                    detect_idle = (status_check[0]-compare_heat_time[list_data]).total_seconds()
                    if detect_idle > 140 and skip_idle_check[list_data] != 0:
                        print(status_check[0],status_check[2],detect_idle,skip_idle_check,"idle by time detected")
                        skip_idle_check[list_data] = 0
                        cycle_time = 0
                        count_shift = 0
                        overright = 0
                        clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_heat",
                        "department": "Heat",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": overright,
                            "heat": overright,
                            "count_signal": status_check[9],
                            "idle": status_check[10],
                            "setting": status_check[11],
                            "alarm": status_check[12],
                            "offline": status_check[13],
                            "alarm_code": status_check[14],
                            "cycle_time": cycle_time,
                            "count_shift": count_shift
                        }
                    })
                        broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_heat",
                        "department": "Heat",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "heat": status_check[8],
                            "count_signal": status_check[9],
                            "idle": status_check[10],
                            "setting": status_check[11],
                            "alarm": status_check[12],
                            "offline": status_check[13],
                            "alarm_code": status_check[14],
                            # "cycle_time": cycle_time,
                            # "count_shift": count_shift
                        }
                    })
                    else : 
                        pass            
                else : 
                    pass
                
                status_count_check = machine_data[list_data].copy()
                count_check = status_count_check[point_int[0]]
                if count_check != 0:
                    if count_check != compare_heat_count[list_data]:
                        old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
                        cycle_time = 0
                        if old_row == () or old_row == None:
                            cycle_time = point_int[3]
                        else:
                            for row in old_row:
                                if row[point_str[0]] == 1 or row[point_str[1]] == 1:
                                    cycle_time = point_int[3]
                                    break
                            if cycle_time != point_int[3]:
                                cycle_time = round((status_count_check[0] - old_row[0]["timestamp"]).total_seconds(), 2)
                                if cycle_time > point_int[3]*1.5:
                                    cycle_time = point_int[3]*1.5
                        count_shift = count_current_shift(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1       
                        compare_heat_count[list_data] = count_check
                        clean_db_q.put({
                            "event": "plc_clean",
                            "source": "clean_heat",
                            "department": "Heat",
                            "machine": status_count_check[2],
                            "machine_type": status_count_check[3],   # Machine / Robot
                            "timestamp": status_count_check[0],

                            "context": {
                                "part_name": status_count_check[4],
                                "plan": status_count_check[5],
                                "operator_id": status_count_check[6],
                            },

                            "metrics": {
                                "run": status_count_check[7],
                                "heat": status_count_check[8],
                                "count_signal": status_count_check[9],
                                "idle": status_count_check[10],
                                "setting": status_count_check[11],
                                "alarm": status_count_check[12],
                                "offline": status_count_check[13],
                                "alarm_code": status_count_check[14],
                                "cycle_time": cycle_time,
                                "count_shift": count_shift
                            }
                        })                             
                        broadcast_q.put({
                            "event": "plc_clean",
                            "source": "clean_heat",
                            "department": "Heat",
                            "machine": status_count_check[2],
                            "machine_type": status_count_check[3],   # Machine / Robot
                            "timestamp": status_count_check[0],

                            "context": {
                                "part_name": status_count_check[4],
                                "plan": status_count_check[5],
                                "operator_id": status_count_check[6],
                            },

                            "metrics": {
                                "run": status_count_check[7],
                                "heat": status_count_check[8],
                                "count_signal": status_count_check[9],
                                "idle": status_count_check[10],
                                "setting": status_count_check[11],
                                "alarm": status_count_check[12],
                                "offline": status_count_check[13],
                                "alarm_code": status_count_check[14],
                                "cycle_time": cycle_time,
                                "count_shift": count_shift
                            }
                        })
                    else : 
                        pass
                else :
                    compare_heat_count[list_data] = count_check
        else:
            pass
    except Exception as e:
        print("❌ Heat clean data error:",e)

def lathe_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [11,1,18,90,2]
    point_str = ["alarm","offline"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data_range in (all_data[point_int[4]]):
                if data_range["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data_range["type_"])
                    if data_range["note_"] == "Part_Name":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Plan" :
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "Alarm_Code":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "ID_Operator":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Status":
                        pick_up = bit_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
                    elif data_range["note_"] == "Max" or data_range["note_"] == "Min" or data_range["note_"] == "Max-Min" or data_range["note_"] == "Limit" or data_range["note_"] == "Mc_Time":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
            machine_data.append(each_machine)
        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check = machine_data[list_data].copy()
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_lathe_status[list_data]:
                    cycle_time = 0
                    count_shift = 0
                    compare_lathe_status[list_data] = status_check[point_int[1]:point_int[2]]
                    # print("from status check",status_check)
                    clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_lathe",
                        "department": "Lathe",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "idle": status_check[8],                            
                            "alarm": status_check[9],
                            "offline": status_check[10],                           
                            "count_signal": status_check[11],
                            "alarm_code": status_check[12], 
                            "cycle_time": cycle_time,
                            "count_shift": count_shift,
                            "max": status_check[13],
                            "min": status_check[14],
                            "max_min": status_check[15],
                            "limit": status_check[16],
                            "mc_time": status_check[17]
                        }
                    })
                    broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_lathe",
                        "department": "Lathe",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "idle": status_check[8],                            
                            "alarm": status_check[9],
                            "offline": status_check[10],                           
                            "count_signal": status_check[11],
                            "alarm_code": status_check[12],
                            # "cycle_time": cycle_time,
                            # "count_shift": count_shift,
                            "max": status_check[13],
                            "min": status_check[14],
                            "max_min": status_check[15],
                            "limit": status_check[16],
                            "mc_time": status_check[17]
                        }
                    })
                else : 
                    pass
                
                status_count_check = machine_data[list_data].copy()
                count_check = status_count_check[point_int[0]]
                if count_check != 0:
                    if count_check != compare_lathe_count[list_data]:
                        old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
                        cycle_time = 0
                        if old_row == () or old_row == None:
                            cycle_time = point_int[3]
                        else:
                            for row in old_row:
                                if row[point_str[0]] == 1 or row[point_str[1]] == 1 :
                                    cycle_time = point_int[3]
                                    break
                            if cycle_time != point_int[3]:
                                cycle_time = round((status_count_check[0] - old_row[0]["timestamp"]).total_seconds(), 2)
                                if cycle_time > point_int[3]*2:
                                    cycle_time = point_int[3]
                        count_shift = count_current_shift(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1                            
                        compare_lathe_count[list_data] = count_check
                        # print("from count check",status_count_check)
                        clean_db_q.put({
                            "event": "plc_clean",
                            "source": "clean_lathe",
                            "department": "Lathe",
                            "machine": status_count_check[2],
                            "machine_type": status_count_check[3],   # Machine / Robot
                            "timestamp": status_count_check[0],

                            "context": {
                                "part_name": status_count_check[4],
                                "plan": status_count_check[5],
                                "operator_id": status_count_check[6],
                            },

                            "metrics": {
                                "run": status_count_check[7],
                                "idle": status_count_check[8],                            
                                "alarm": status_count_check[9],
                                "offline": status_count_check[10],                           
                                "count_signal": status_count_check[11],
                                "alarm_code": status_count_check[12], 
                                "cycle_time": cycle_time,
                                "count_shift": count_shift,
                                "max": status_count_check[13],
                                "min": status_count_check[14],
                                "max_min": status_count_check[15],
                                "limit": status_count_check[16],
                                "mc_time": status_count_check[17]
                            }
                        })
                        broadcast_q.put({
                            "event": "plc_clean",
                            "source": "clean_lathe",
                            "department": "Lathe",
                            "machine": status_count_check[2],
                            "machine_type": status_count_check[3],   # Machine / Robot
                            "timestamp": status_count_check[0],

                            "context": {
                                "part_name": status_count_check[4],
                                "plan": status_count_check[5],
                                "operator_id": status_count_check[6],
                            },

                            "metrics": {
                                "run": status_count_check[7],
                                "idle": status_count_check[8],                            
                                "alarm": status_count_check[9],
                                "offline": status_count_check[10],                           
                                "count_signal": status_count_check[11],
                                "alarm_code": status_count_check[12], 
                                "cycle_time": cycle_time,
                                "count_shift": count_shift,
                                "max": status_count_check[13],
                                "min": status_count_check[14],
                                "max_min": status_count_check[15],
                                "limit": status_count_check[16],
                                "mc_time": status_count_check[17]
                            }
                        })
                    else : 
                        pass
                else :
                    compare_lathe_count[list_data] = count_check       
    except Exception as e:
        print("❌ Lathe clean data error:",e)

```

### db_connector.py
```python
# backend/python/utils/db_connector.py
from pathlib import Path
import os
from dbutils.pooled_db import PooledDB
import pymysql
from dotenv import load_dotenv
from datetime import datetime

# --- Load config ---
env_path = Path(__file__).parent.parent.parent / "node" / ".env"
load_dotenv(dotenv_path=env_path)

# --- Create connection pool ---
def create_pool():
    try:
        pool = PooledDB(
            creator=pymysql,
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT")),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            mincached=int(os.getenv("DB_MIN", 1)),
            maxcached=int(os.getenv("DB_MAX", 5)),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True  # Important: auto-commit INSERTs
        )
        print("✅ MySQL connection pool created")
        return pool
    except Exception as e:
        print(f"❌ Failed to create DB pool: {e}")
        return None

# --- Count production ---
def count_production(_db_pool,timestamp,department,machine,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_press
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND part_name = %s AND count_signal = %s
        """
    elif department == "Heat":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_heat
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND part_name = %s AND count_signal = %s
        """
    elif department == "Lathe":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_lathe
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND part_name = %s AND count_signal = %s
        """
    cursor = conn.cursor()
    cursor.execute(query, (timestamp,department,machine,part_name,1))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result['count_output'] if result and 'count_output' in result else 0
from datetime import datetime, time, timedelta
# --- Count current shift ---
def get_shift_range(current_dt):
    t = current_dt.time()

    shift_a_start = time(6, 0)
    shift_b_start = time(14, 0)
    shift_c_start = time(22, 0)

    if shift_a_start <= t < shift_b_start:
        shift = "A"
        start = current_dt.replace(hour=6, minute=0, second=0, microsecond=0)
        end = current_dt.replace(hour=14, minute=0, second=0, microsecond=0)

    elif shift_b_start <= t < shift_c_start:
        shift = "B"
        start = current_dt.replace(hour=14, minute=0, second=0, microsecond=0)
        end = current_dt.replace(hour=22, minute=0, second=0, microsecond=0)

    else:
        shift = "C"
        start = current_dt.replace(hour=22, minute=0, second=0, microsecond=0)

        # ถ้าเป็นหลังเที่ยงคืน ต้องย้อนวัน
        if t < shift_a_start:
            start = start - timedelta(days=1)

        end = start + timedelta(hours=8)

    return shift, start, end
def count_current_shift(_db_pool, timestamp, department, machine):
    conn = _db_pool.connection()
    current_dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S.%f")

    shift, start_time, end_time = get_shift_range(current_dt)

    table_map = {
        "Press": "raw_press",
        "Heat": "raw_heat",
        "Lathe": "raw_lathe"
    }

    table_name = table_map.get(department)
    if not table_name:
        return 0

    query = f"""
        SELECT COUNT(count_signal) AS count_output
        FROM {table_name}
        WHERE timestamp >= %s
        AND timestamp < %s
        AND department = %s
        AND machine = %s
        AND count_signal = 1
    """

    cursor = conn.cursor()
    cursor.execute(query, (start_time, end_time, department, machine))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    return result['count_output'] if result else 0
# --- Row after output ---
def row_after_output(_db_pool,timestamp,department,machine_name,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT timestamp,count_signal,idle,alarm,offline
            FROM raw_press
            WHERE id_row >=(
                SELECT id_row
                FROM raw_press
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
            LIMIT 10
        """
    elif department == "Heat":
        query = """
            SELECT timestamp,count_signal,idle,setting,alarm,offline
            FROM raw_heat
            WHERE id_row >=(
                SELECT id_row
                FROM raw_heat
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
            LIMIT 10
        """ 
    elif department == "Lathe":
        query = """
            SELECT timestamp,count_signal,idle,alarm,offline
            FROM raw_lathe
            WHERE id_row >=(
                SELECT id_row
                FROM raw_lathe
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC 
            LIMIT 10
        """  
    cursor = conn.cursor()
    cursor.execute(query,(timestamp,department,machine_name,part_name,1,timestamp,department,machine_name,part_name))
    row = cursor.fetchall()  
    cursor.close()
    conn.close()
    return row

if __name__ == "__main__":
    try:
        db_pool = create_pool()
        row = row_after_output(
            db_pool,
            '2026-02-19 09:13:51.11',
            'Press',
            'AIDA630T',
            '45351-KVB-S020-M2'
            )
        # row = count_current_shift(
        #     db_pool,
        #     '2026-02-18 15:00:00.00',
        #     'Heat',
        #     'DKK2'
        # )
        print(row)

    except Exception as e:
        print(f"{e}")
```

### db_writer.py
```python
# backend/python/utils/db_writer.py

# --- fatten data ---
def flatten_press_event(data):
    return {
        "event": data["event"],
        "source": data["source"],
        "department": data["department"],
        "machine": data["machine"],
        "machine_type": data["machine_type"],
        "timestamp": data["timestamp"],
        "part_name": data["context"]["part_name"],
        "plan": data["context"]["plan"],
        "operator_id": data["context"]["operator_id"],
        "count_signal": data["metrics"]["count_signal"],
        "run": data["metrics"]["run"],
        "idle": data["metrics"]["idle"],
        "alarm": data["metrics"]["alarm"],
        "offline": data["metrics"]["offline"],
        "alarm_code": data["metrics"]["alarm_code"],
        "cycle_time": data["metrics"]["cycle_time"],
        "count_shift": data["metrics"]["count_shift"],
    }
def flatten_heat_event(data):
    return {
        "event": data["event"],
        "source": data["source"],
        "department": data["department"],
        "machine": data["machine"],
        "machine_type": data["machine_type"],
        "timestamp": data["timestamp"],
        "part_name": data["context"]["part_name"],
        "plan": data["context"]["plan"],
        "operator_id": data["context"]["operator_id"],
        "run": data["metrics"]["run"],     
        "heat": data["metrics"]["heat"],   
        "count_signal": data["metrics"]["count_signal"],
        "idle": data["metrics"]["idle"],
        "setting": data["metrics"]["setting"],
        "alarm": data["metrics"]["alarm"],
        "offline": data["metrics"]["offline"],
        "alarm_code": data["metrics"]["alarm_code"],
        "cycle_time": data["metrics"]["cycle_time"],
        "count_shift": data["metrics"]["count_shift"],
    }
def flatten_lathe_event(data):
    return {
        "event": data["event"],
        "source": data["source"],
        "department": data["department"],
        "machine": data["machine"],
        "machine_type": data["machine_type"],
        "timestamp": data["timestamp"],
        "part_name": data["context"]["part_name"],
        "plan": data["context"]["plan"],
        "operator_id": data["context"]["operator_id"],
        "count_signal": data["metrics"]["count_signal"],
        "run": data["metrics"]["run"],
        "idle": data["metrics"]["idle"],
        "alarm": data["metrics"]["alarm"],
        "offline": data["metrics"]["offline"],
        "alarm_code": data["metrics"]["alarm_code"],
        "cycle_time": data["metrics"]["cycle_time"],
        "count_shift": data["metrics"]["count_shift"],
        "max_value": data["metrics"]["max"],
        "min_value": data["metrics"]["min"],
        "max_min": data["metrics"]["max_min"],
        "limit_value": data["metrics"]["limit"],
        "mc_time": data["metrics"]["mc_time"],
    }

# --- Save function ---  
def save_press_data(_db_pool, data):
    # return True
    try:

        conn = _db_pool.connection()
        cursor = conn.cursor()
        flatten_data = flatten_press_event(data)
        query = """
        INSERT INTO raw_press (
            event, source, department, machine, machine_type, timestamp,
            part_name, plan, operator_id,
            count_signal, run, idle, alarm, offline,
            alarm_code, cycle_time, count_shift
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            flatten_data['event'],
            flatten_data['source'],
            flatten_data['department'],
            flatten_data['machine'],
            flatten_data['machine_type'],
            flatten_data['timestamp'],
            flatten_data['part_name'],
            flatten_data['plan'],
            flatten_data['operator_id'],
            flatten_data['count_signal'],
            flatten_data['run'],
            flatten_data['idle'],
            flatten_data['alarm'],
            flatten_data['offline'],
            flatten_data['alarm_code'],
            flatten_data['cycle_time'],
            flatten_data['count_shift']
        )

        cursor.execute(query, values)

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
 
def save_heat_data(_db_pool,data):
    # return True
    try:
        conn = _db_pool.connection()
        cursor = conn.cursor()
        flatten_data = flatten_heat_event(data)
        query = """
        INSERT INTO raw_heat (
            event, source, department, machine, machine_type, timestamp,
            part_name, plan, operator_id,
            run, heat, count_signal, idle, setting, alarm, offline, 
            alarm_code, cycle_time, count_shift 
        ) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            flatten_data['event'],
            flatten_data['source'],
            flatten_data['department'],
            flatten_data['machine'],
            flatten_data['machine_type'],
            flatten_data['timestamp'],
            flatten_data['part_name'],
            flatten_data['plan'],
            flatten_data['operator_id'],
            flatten_data['run'],
            flatten_data['heat'],
            flatten_data['count_signal'],
            flatten_data['idle'],
            flatten_data['setting'],
            flatten_data['alarm'],
            flatten_data['offline'],
            flatten_data['alarm_code'],
            flatten_data['cycle_time'],
            flatten_data['count_shift']
        )
        cursor.execute(query, values)            

        cursor.close()
        conn.close() # not needed; returned to pool automatically
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
    
def save_lathe_data(_db_pool,data):
    # return True
    try:

        conn = _db_pool.connection()
        cursor = conn.cursor()
        flatten_data = flatten_lathe_event(data)
        query = """
        INSERT INTO raw_lathe (
            event, source, department, machine, machine_type, timestamp,
            part_name, plan, operator_id,
            count_signal, run, idle, alarm, offline,
            alarm_code, cycle_time, count_shift,
            max_value, min_value, max_min, limit_value, mc_time
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            flatten_data['event'],
            flatten_data['source'],
            flatten_data['department'],
            flatten_data['machine'],
            flatten_data['machine_type'],
            flatten_data['timestamp'],
            flatten_data['part_name'],
            flatten_data['plan'],
            flatten_data['operator_id'],
            flatten_data['count_signal'],
            flatten_data['run'],
            flatten_data['idle'],
            flatten_data['alarm'],
            flatten_data['offline'],
            flatten_data['alarm_code'],
            flatten_data['cycle_time'],
            flatten_data['count_shift'],
            flatten_data['max_value'],
            flatten_data['min_value'],
            flatten_data['max_min'],
            flatten_data['limit_value'],
            flatten_data['mc_time']
        )

        cursor.execute(query, values)

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False

```



## Frontend
### index.html
```html
<!-- // frontend/public/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SCADA.SET</title>
    <link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,700" rel="stylesheet">
    <link rel="stylesheet" href="/css/fontawesome/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
  </head>
  <body>
    <header id="topbar">
      <div class="topbar-left">
        <h1>SCADA.SET</h1>
      </div>

      <div class="topbar-center">
        <span id="digital-clock"></span>
      </div>

      <div class="topbar-right">
        <span id="user-role"></span>
        <button id="logout-btn">
          Logout <i class="fa-solid fa-right-to-bracket fa-flip-horizontal"></i>
        </button>
      </div>
    </header>


    <div class="layout">
      <aside id="sidebar"></aside>
      <main id="app" class="page"></main>
    </div>

    <footer id="footer">
      <div class="footer-content">
        © 2026 SCADA.SET | Developed by Production engineer Team | Sunstar engineering(Thailand) Co.,Ltd.
      </div>
    </footer>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@2.2.0/dist/chartjs-plugin-annotation.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script type="module" src="/js/app.js"></script>
  </body>
</html>
```

### login.html
```html
<!-- // frontend/public/login.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SET SCADA : Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/fontawesome/all.min.css">
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
      <button type="submit" class="btn">Login <i class="fa-solid fa-arrow-right-to-bracket"> </i> </button>
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
```

### app.js
```javaScript
// frontend/public/js/app.js
import { renderSidebar } from './sidebar.js';
import { initSidebarBehavior,setActiveSidebar } from './sidebar-behavior.js';
import { routes } from './routes.js';
import { scadaStore } from './store.js';

let currentUnmount = null;
let currentUserRole = null;
window.scadaStore = scadaStore; // 👈 debug only

// Auth check
async function checkAuth() {
  const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
  const auth = await res.json();
  if (!auth.authenticated) {
    window.location.href = '/login.html';
    return false;
  }
  currentUserRole = auth.role;
  return true;
}

function mountTopbar() {
  const btn = document.getElementById('logout-btn');
  const roleEl = document.getElementById('user-role');

  if (roleEl) roleEl.textContent = currentUserRole;

  if (btn) {
    btn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      window.location.href = '/login.html';
    });
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { 
    method: 'POST', 
    credentials: 'same-origin' 
  });
  window.location.href = '/login.html';
}
let localTimer = null;

function startLocalTicker() {

  if (localTimer) return; // prevent multiple timers

  localTimer = setInterval(() => {

    Object.values(scadaStore.state.machines).forEach(machine => {

      if (!machine.status) return;

      const bucketMap = {
        RUNNING: 'run_seconds',
        IDLE: 'idle_seconds',
        ALARM: 'alarm_seconds',
        OFFLINE: 'offline_seconds'
      };

      const bucket = bucketMap[machine.status];
      if (!bucket) return;

      machine.shiftDurations[bucket] += 1;

    });

    scadaStore.notify();

  }, 1000);
}

function initWebSocket() {
  if (scadaStore.ws) return;

  // const ws = new WebSocket('ws://localhost:3000');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}`);

  scadaStore.ws = ws;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);


    if (msg.type === 'plc_snapshot') {
      clearInterval(localTimer);
      localTimer = null;      
      scadaStore.setSnapshot(msg.payload);
      startLocalTicker();
    }


    if (msg.type === 'plc_update') {
      scadaStore.applyUpdate(msg.payload);
    }

    if (msg.type === 'plc_clean') {
      scadaStore.applyPlcClean(msg.payload);
    }
  };

  ws.onopen = () => console.log('WS connected');
  ws.onclose = () => {
    console.log('WS disconnected');
    setTimeout(initWebSocket, 2000); // auto-reconnect
  };
}

function mountSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = renderSidebar(currentUserRole);
  initSidebarBehavior(navigate);

}

function initSidebarToggle() {
  const layout = document.querySelector('.layout');

  // IMPORTANT: button is inside sidebar
  const btn = document.getElementById('toggleSidebar');
  const icon = document.getElementById('toggleIcon');
  if (!btn || !layout) return;

  const updateIcon = () => {
    if (layout.classList.contains('sidebar-collapsed')) {
      icon.classList.remove('fa-angles-left');
      icon.classList.add('fa-angles-right');
    } else {
      icon.classList.remove('fa-angles-right');
      icon.classList.add('fa-angles-left');
    }
  };

  btn.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');
    updateIcon();

    localStorage.setItem(
      'sidebar-collapsed',
      layout.classList.contains('sidebar-collapsed')
    );
  });

  // Restore state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
  }
  
  // Set initial icon
  updateIcon();
}

function startClock() {
  const clockEl = document.getElementById('digital-clock');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();

    const date = now.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const time = now.toLocaleTimeString();

    clockEl.textContent = `${date} | ${time}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}


export async function navigate(route) {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  if (currentUnmount) currentUnmount();

  const app = document.getElementById('app');
  app.className = 'page';

  const parts = route.split('.');
  let node = routes;

  for (const part of parts) {
    node = node?.[part];
  }

  if (!node) {
    console.warn('Route not found:', route);
    return;
  }

  // Role guard
  if (node.role && node.role !== currentUserRole) {
    alert('Access denied');
    return;
  }

  // Page wrapper class
  app.classList.add(`page-${parts[0]}`);

  // Clear page
  app.innerHTML = '';

  // Render static HTML if provided
  if (node.view) {
    app.innerHTML = node.view();
  }

  // Mount dynamic logic (WS, subscriptions, DOM updates)
  node.mount?.(app);

  currentUnmount = node.unmount || null;

  // Sync sidebar
  setActiveSidebar(route);
}


function handleHashNavigation() {
  const hash = window.location.hash.slice(1); // drop '#'
  if (!hash) return;

  const [path] = hash.split('?');
  const route = path.replace(/\//g, '.');
  if (route) navigate(route);
}

async function bootstrap() {
  const ok = await checkAuth();
  if (!ok) return;

  initWebSocket();
  mountTopbar();
  mountSidebar();        // injects sidebar HTML
  initSidebarToggle();   // now button exists

  // if user landed with a hash, navigate there; otherwise go home
  if (window.location.hash) {
    handleHashNavigation();
  } else {
    navigate('home');
  }

  startClock();
}

// respond when something else (like a card click) updates the hash
window.addEventListener('hashchange', handleHashNavigation);

bootstrap();

```

### api.js
```javaScript
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
```

### routes.js
```javaScript
// frontend/public/js/routes.js
import * as Home from './views/home.js';
import * as Production from './views/production.js';
import * as Maintenance from './views/maintenance.js';
import * as Admin from './views/admin.js';

export const routes = {
  home: {
    view: Home.homeView,
    mount: Home.homeMount,
    unmount: Home.homeUnmount
  },

  production: {
    overview: {
      mount: Production.productionOverviewMount,
      unmount: Production.productionOverviewUnmount
    },
    machine_efficiency: {
      view: Production.productionMachineEfficiencyView,
      mount: Production.productionMachineEfficiencyMount,
      unmount: Production.productionMachineEfficiencyUnmount
    },
    production_history: {
      view: Production. productionProductionHistoryView
    },
    staff_management: {
      view: Production.productionStaffManagementView
    }
  },

  maintenance: {
    overview: {
      plant1: { view: Maintenance.plant1View },
      plant2: { view: Maintenance.plant2View }
    },
    request: { view: Maintenance.requestView },
    report: { view: Maintenance.reportView }
  },

  admin: {
    alarm: {
      view: Admin.adminAlarmView,
      mount: Admin.adminAlarmMount,
      unmount: Admin.adminAlarmUnmount,
      role: 'admin'
    },
    database: {
      view: Admin.adminDatabaseView,
      role: 'admin'
    }
  }

};

```

### shiftSummary.js
```javaScript
// frontend/public/js/shiftSummary.js
async function loadShiftSummary(date, shift = null) {

  let url = `/api/shift-summary?date=${date}`;

  if (shift) {
    url += `&shift=${shift}`;
  }

  const res = await fetch(url);
  const json = await res.json();

  if (!json.success) {
    console.error('Failed to load shift summary');
    return;
  }

  renderShiftSummary(json.data);
}

function renderShiftSummary(data) {

  const container = document.getElementById('shiftSummaryTable');
  container.innerHTML = '';

  data.departments.forEach(dept => {

    const deptPercent = (dept.availability * 100).toFixed(2);

    const deptDiv = document.createElement('div');
    deptDiv.className = 'department-block';

    deptDiv.innerHTML = `
      <h3>${dept.department} - ${deptPercent}%</h3>
    `;

    dept.machines.forEach(machine => {

      const percent = (machine.availability * 100).toFixed(2);

      const row = document.createElement('div');
      row.innerHTML = `
        ${machine.machine}
        | Run: ${machine.run_seconds}s
        | Idle: ${machine.idle_seconds}s
        | Alarm: ${machine.alarm_seconds}s
        | ${percent}%
      `;

      deptDiv.appendChild(row);
    });

    container.appendChild(deptDiv);
  });

  // 🔥 Total factory
  const totalPercent = (data.totalAvailability * 100).toFixed(2);

  const totalDiv = document.createElement('h2');
  totalDiv.innerHTML = `Factory Availability: ${totalPercent}%`;

  container.prepend(totalDiv);
}
```

### sidebar-behavior.js
```javaScript
// frontend/public/js/sidebar-behavior.js
export function initSidebarBehavior(navigate) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('click', (e) => {
    const toggleLink = e.target.closest('li.sub-menu > a');
    if (!toggleLink) return;

    e.preventDefault();

    const layout = document.querySelector('.layout');

    // If collapsed → expand only
    if (layout.classList.contains('sidebar-collapsed')) {
      layout.classList.remove('sidebar-collapsed');
      return;
    }

    const parentLi = toggleLink.parentElement;
    const submenu = parentLi.querySelector(':scope > ul');
    if (!submenu) return;

    // Close siblings at SAME LEVEL only
    parentLi.parentElement
      .querySelectorAll(':scope > li.sub-menu')
      .forEach(li => {
        if (li !== parentLi) {
          const ul = li.querySelector(':scope > ul');
          if (ul) ul.style.display = 'none';
          li.classList.remove('open');
        }
      });

    // Toggle current
    const isOpen = submenu.style.display === 'block';
    submenu.style.display = isOpen ? 'none' : 'block';
    parentLi.classList.toggle('open', !isOpen);
  });

  // Navigation (leaf nodes)
  sidebar.addEventListener('click', (e) => {
    const pageLink = e.target.closest('a[data-page]');
    if (!pageLink) return;

    e.preventDefault();
    navigate(pageLink.dataset.page);
    setActiveSidebar(pageLink.dataset.page);
  });
}


export function setActiveSidebar(page) {
  document.querySelectorAll('#leftside-navigation li')
    .forEach(li => li.classList.remove('active'));

  const activeLink = document.querySelector(`a[data-page="${page}"]`);
  if (!activeLink) return;

  let li = activeLink.closest('li');
  while (li) {
    li.classList.add('active');
    li = li.parentElement.closest('li');
  }

  // ensure parents are open
  document.querySelectorAll('.sub-menu.active > ul')
    .forEach(ul => ul.style.display = 'block');
}

```

### sidebar.js
```javaScript
// frontend/public/js/sidebar.js
export function renderSidebar(role) {
  return `
  <div class="sidebar-header">
    <button class="toggle-sidebar" id="toggleSidebar">
      <i class="fa-solid fa-angles-left" id="toggleIcon"></i>
    </button>
  </div>

  <div id="leftside-navigation">
    <ul class="nano-content">

      <li>
        <a data-page="home" data-title="Home">
          <i class="fa fa-dashboard"></i><span>Home</span>
        </a>
      </li>

      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Production">
          <i class="fa fa-table"></i><span>Production</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>
        <ul>
          <li><a data-page="production.overview">Overview</a></li>
          <li><a data-page="production.machine_efficiency">Machine efficiency</a></li>
          <li><a data-page="production.production_history">Production History</a></li>
          <li><a data-page="production.staff_management">Staff management</a></li>
        </ul>
      </li>

      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Maintenance">
          <i class="fa fa-tasks"></i><span>Maintenance</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>

        <ul>
          <li class="sub-menu">
            <a href="javascript:void(0);" data-title="Overview machine">
              <i class="fa fa-desktop"></i><span>Overview machine</span>
              <i class="arrow fa fa-angle-right"></i>
            </a>

            <ul>
              <li><a data-page="maintenance.overview.plant1">Plant 1</a></li>
              <li><a data-page="maintenance.overview.plant2">Plant 2</a></li>
            </ul>
          </li>

          <li><a data-page="maintenance.request">Maintenance request</a></li>
          <li><a data-page="maintenance.report">Report</a></li>
        </ul>
      </li>

      ${role === 'admin' ? `
      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Admin">
          <i class="fa fa-cog"></i><span>Admin</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>
        <ul>
          <li><a data-page="admin.alarm">Alarm Handle</a></li>
          <li><a data-page="admin.database">Database</a></li>
        </ul>
      </li>` : ''}

    </ul>
  </div>
  `;
}

```

### store.js
```javaScript
// frontend/public/js/store.js
function deriveStatus(department, metrics = {}) {
  if (metrics.offline === 1) return 'OFFLINE';

  const noSignal =
    !metrics.run &&
    !metrics.idle &&
    !metrics.alarm &&
    !metrics.setting &&
    !metrics.heat;

  if (noSignal) return 'OFFLINE';

  if (metrics.alarm === 1) return 'ALARM';

  if (department?.toLowerCase() === 'heat') {
    if (metrics.run === 1 || metrics.heat === 1) {
      return 'RUNNING';
    }

    if (
      metrics.run === 0 &&
      metrics.heat === 0 &&
      metrics.idle === 1
    ) {
      return 'IDLE';
    }

    return 'STOP';
  }

  if (metrics.run === 1) return 'RUNNING';
  if (metrics.idle === 1) return 'IDLE';

  return 'STOP';
}

export const scadaStore = {
  state: {
    timestamp: null,
    machines: {}
  },

  ws: null,
  listeners: new Set(),

  // 🔐 Only entry point for WS data
  setSnapshot(snapshot) {
    this.state.timestamp = snapshot.timestamp ?? this.state.timestamp;
    this.state.machines = snapshot.machines ?? this.state.machines;
    this.notify();
  },

  applyUpdate({ machineId, changes }) {
    if (!this.state.machines[machineId]) return;

    const m = this.state.machines[machineId];

    if (changes.status) m.status = changes.status;
    if (changes.tags) Object.assign(m.tags, changes.tags);
    if (changes.alarms) m.alarms = changes.alarms;

    this.state.timestamp = Date.now();
    this.notify();
  },

  applyPlcClean(payload) {
    const key = `${payload.department.toLowerCase()}_${payload.machine}`;

    const prev = this.state.machines[key] || {
      department: payload.department,
      machineType: payload.machine_type,
      status: 'STOP',
      tags: {},
      context: {},
      alarms: []
    };

    this.state.machines[key] = {
      ...prev,
      department: payload.department,
      machineType: payload.machine_type,
      status: deriveStatus(payload.department, payload.metrics),
      lastUpdate: Date.now(),
      timestamp: payload.timestamp,

      context: {
        ...prev.context,
        ...(payload.context || {})
      },

      tags: {
        ...prev.tags,
        ...(payload.metrics.cycle_time !== undefined && {
          cycle_time: payload.metrics.cycle_time
        }),
        ...(payload.metrics.count_shift !== undefined && {
          count_shift: payload.metrics.count_shift
        })
      },

      cycleHistory: payload.cycleHistory ?? prev.cycleHistory ?? [],

      alarms: payload.metrics.alarm
        ? [payload.metrics.alarm_code]
        : []
    };


    this.notify();
  },

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  },

  subscribe(fn) {
    this.listeners.add(fn);

    // immediate sync
    fn(this.state);

    return () => this.listeners.delete(fn);
  }
};


```

### storeSelectors.js
```javaScript
// frontend/public/js/storeSelectors.js
export function selectAllMachines(state) {
  return Object.entries(state.machines);
}

export function selectByPlant(state, plantId) {
  return Object.entries(state.machines)
    .filter(([id]) => id.startsWith(plantId));
}

export function selectAlarms(state) {
  return Object.entries(state.machines)
    .flatMap(([id, m]) =>
      m.alarms.map(code => ({
        machineId: id,
        code
      }))
    );
}

export function selectOverview(state) {
  return {
    total: Object.keys(state.machines).length,
    running: Object.values(state.machines).filter(m => m.status === 'RUNNING').length,
    fault: Object.values(state.machines).filter(m => m.alarms.length).length
  };
}

export function selectPressMachines(state) {
  return Object.entries(state.machines)
    .filter(([id]) => id.toLowerCase().includes('press'));
}

```

### utils.js
```javaScript
// frontend/public/js/utils.js
function formatDuration(totalSeconds, statusStartedAt = null) {

  let seconds = totalSeconds;
  let msPart = 0;

  // If machine is currently active, add smooth ms
  if (statusStartedAt) {
    const now = Date.now();
    const diffMs = now - statusStartedAt;

    msPart = Math.floor((diffMs % 1000) / 10); // 0–99
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n, size = 2) => String(n).padStart(size, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(msPart)}`;
}

export { formatDuration };
```

### admin.js
```javaScript
// frontend/public/js/views/admin.js
export function adminAlarmView() {
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
        <label>Alarm History Range:</label>
        <select id="alarm-range">
          <option value="15">Last 15 minutes</option>
          <option value="30">Last 30 minutes</option>
          <option value="60" selected>Last 1 hour</option>
          <option value="480">Last 8 hours</option>
          <option value="1440">Last 24 hours</option>
        </select>
      </div>      

      <div class="card">
        <h3>🚨 Active Alarms</h3>
        <ul id="alarm-list" class="alarm-list"></ul>
      </div>

      <div class="card">
        <h3>🧾 Alarm History</h3>
        <ul id="alarm-history" class="alarm-history"></ul>
      </div>
  `;
}

export function adminDatabaseView() {
  return `
    <div class="card">
      <h2>Content Management</h2>
      <image src="/images/Availability.png" style="width: 600px; height: auto;"><br>
      <image src="/images/Performance.png" style="width: 600px; height: auto;"><br>
      <image src="/images/OEE.png" style="width: 600px; height: auto;">
    </div>
  `;
}

import { sendPlcCommand } from '../api.js';
import { scadaStore } from '../store.js';


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

export async function adminAlarmMount() {
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

  function handleAlarmEvent(msg) {
    if (msg.type !== 'alarm_event') return;
    loadAlarms(); // re-render list instantly
  }

  alarmList.onclick = async (e) => {
    if (!e.target.classList.contains('ack-btn')) return;

    const id = e.target.dataset.id;

    await fetch(`/api/alarms/ack/${id}`, {
      method: 'POST',
      credentials: 'same-origin'
    });

    loadAlarms();
  };

  async function loadAlarms() {
    const rangeMin = document.getElementById('alarm-range')?.value || 60;

    const from = new Date(Date.now() - rangeMin * 60 * 1000).toISOString();

    const res = await fetch(
      `/api/alarm-history?from=${encodeURIComponent(from)}`,
      { credentials: 'same-origin' }
    );

    if (!res.ok) {
      alarmList.innerHTML = '<li>No alarm access</li>';
      return;
    }

    const alarms = await res.json();

    if (!Array.isArray(alarms)) return;

    alarmList.innerHTML = alarms
      .slice()
      .reverse()
      .map(a => `
        <li class="alarm ${a.severity.toLowerCase()}">
          <strong>${a.code}</strong>
          <span>${a.message}</span>
          <small>${new Date(a.ts).toLocaleString()}</small>
        </li>
      `)
      .join('');
  }

  async function loadAlarmHistory() {
    const el = document.getElementById('alarm-history');

    const res = await fetch('/api/alarm-history', {
      credentials: 'same-origin'
    });

    if (!res.ok) {
      el.innerHTML = '<li>No access</li>';
      return;
    }

    const logs = await res.json();

    el.innerHTML = logs
      .slice()
      .reverse()
      .map(l => `
        <li class="alarm ${l.severity.toLowerCase()}">
          <strong>${l.code}</strong>
          <span>${l.message}</span>
          <small>${new Date(l.ts).toLocaleString()}</small>
        </li>
      `)
      .join('');
  }
  const ws = scadaStore.ws;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    handleAlarmEvent(msg);
  });

  document.getElementById('alarm-range')
  .addEventListener('change', loadAlarms);

  await loadAlarms();
  await loadAlarmHistory();

}

export function adminAlarmUnmount() {
  if (alarmTimer) clearInterval(alarmTimer);
}
```

### home.js
```javaScript
// frontend/public/js/views/home.js
import { scadaStore } from '../store.js';
let unsubscribe = null;

export function homeView() {
  return `
    <div class="card">
      <h2>Production History</h2>
      <div class="card">
        <h3>📡 Live PLC Data</h3>
        <pre id="plc-data">No data...</pre>
      </div>
    </div>
  `;
}


export async function homeMount() {
  const dataEl = document.getElementById('plc-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });
}

export function homeUnmount() {
  if (unsubscribe) unsubscribe();
}


```

### production.js 
```javaScript
// frontend/public/js/views/production.js 
import { scadaStore } from '../store.js'; 
import { formatDuration } from '../utils.js';
const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding']; 
const availabilityCharts = new Map();
// --------------- Chart plugins --------------- //
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const { ctx, chartArea: { width, height } } = chart;

        const data = chart.data.datasets[0].data;
        // const total = data[0] + data[1];
        const total = data.reduce((a, b) => a + b, 0);

        const percent = total > 0
            ? ((data[0] / total) * 100).toFixed(1)
            : 0;

        ctx.save();

        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#485583";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(percent + "%", width / 2, height / 2);

        ctx.restore();
    }
};

// Chart.register(centerTextPlugin);
// --------------- GLOBALS functions --------------- //
function calculateShiftSummary() { 
    const machines = Object.values(scadaStore.state.machines); 

    let totalRun = 0; 
    let totalIdle = 0; 
    let totalAlarm = 0; 

    machines.forEach(m => {
        if (!m.shiftDurations) return; 
            totalRun += m.shiftDurations.run_seconds || 0; 
            totalIdle += m.shiftDurations.idle_seconds || 0; 
            totalAlarm += m.shiftDurations.alarm_seconds || 0; 
        }); 

    const planned = totalRun + totalIdle + totalAlarm;
    const availability = planned ? (totalRun / planned) * 100 : 0;

    return { 
        availability: availability,
        totalRun,
        totalIdle,
        totalAlarm
    };
}
function kpiClass(v) {
    if (v >= 85) return 'kpi-good';
    if (v >= 60) return 'kpi-warning'; 
    return 'kpi-bad'; 
} 
function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0'); 
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0'); 
    const s = String(sec % 60).padStart(2, '0'); 
    return `${h}:${m}:${s}`; 
}
function renderShiftChart(data) {

  const ctx = document.getElementById('shiftChart').getContext('2d');

  const shifts = data.map(s => `Shift ${s.shift}`);

  const departmentsSet = new Set();

  data.forEach(s => {
    s.departments.forEach(d => {
      departmentsSet.add(d.department);
    });
  });

  const departments = Array.from(departmentsSet);

  const datasets = departments.map(dept => {

    const values = data.map(shift => {
      const found = shift.departments.find(d => d.department === dept);
      return found ? (found.availability * 100).toFixed(2) : 0;
    });

    return {
      label: dept,
      data: values
    };
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shifts,
      datasets
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}
async function loadTodayShiftHistory() {

  const today = new Date().toISOString().split('T')[0];

  const res = await fetch(`/api/shift-history?date=${today}`);
  const json = await res.json();

  if (!json.success) return;

  renderShiftChart(json.data);
}

// ---------------- Overview Page ---------------- // 
let unsubscribe = null; 
export function productionOverviewMount(container) {
    const plantId = 'plant1'; 
    const cardMap = new Map(); // machineId → DOM element 
        let initialized = false;
     
    container.innerHTML = `
        <h1>🏭 Production Overview</h1> 
        <div class="summary-wrapper">
            <div class="summary-card">
                <h3>Shift Summary</h3>

                <div id="summaryKPI" class="summary-grid"></div>

                <canvas id="shiftChart"></canvas>
            </div>
        </div>
        <section id="machine-grid" class="machine-grid"></section> 
    `;
    const grid = container.querySelector('#machine-grid');
    loadTodayShiftHistory();
    
    unsubscribe = scadaStore.subscribe(state => {
        const machines = Object.entries(state.machines); 
        const groups = {}; 
        const summary = calculateShiftSummary(state); 

        const summaryKPI = container.querySelector('#summaryKPI');

        summaryKPI.innerHTML = `
        <div class="summary-box">
            Availability
            <span class="${kpiClass(summary.availability)}">
            ${summary.availability.toFixed(1)}%
            </span>
        </div>
        <div class="summary-box">
            Run
            <span>${formatTime(summary.totalRun)}</span>
        </div>
        <div class="summary-box">
            Idle
            <span>${formatTime(summary.totalIdle)}</span>
        </div>
        <div class="summary-box">
            Alarm
            <span>${formatTime(summary.totalAlarm)}</span>
        </div>
        `;
        
        machines.forEach(([id, m]) => {
            const [dept] = id.split('_'); 
            if (!groups[dept]) groups[dept] = []; 
            groups[dept].push([id, m]); 
        }); 

        // 🔥 FIRST LOAD → build structure once 
        if (!initialized) {
            DEPT_ORDER.forEach(dept => {
                const list = groups[dept]; 
                if (!list) return;

                    const section = document.createElement('section'); 
                    section.className = 'department-section'; 
                    section.dataset.dept = dept; 
                
                    section.innerHTML = `
                        <h2 class="department-title">${dept.toUpperCase()}</h2> 
                        <div class="department-grid"></div> 
                        `; 
                        grid.appendChild(section); 
                    }); 
                    initialized = true; 
        };

        // 🔥 UPDATE / CREATE CARDS 
        machines.forEach(([id, m]) => { 
            let card = cardMap.get(id);
            if (!card) {
                // 🆕 create new card 
                card = createMachineCard(id, m); 
                cardMap.set(id, card); 
                
                const dept = id.split('_')[0]; 
                const section = grid.querySelector(`[data-dept="${dept}"]`); 
                section.querySelector('.department-grid').appendChild(card); 
            } else { 
                // 🔄 update existing card 
                updateMachineCard(card, id, m); 
            } 
        }); 
    }); 
    function statusClass(machine) {
        if (machine.status === 'OFFLINE') return 'offline'; 
        if (machine.alarms?.length) return 'alarm'; 
        return machine.status?.toLowerCase() || 'idle'; 
    }

    function createMachineCard(id, m) {
        const card = document.createElement('div');
        card.className = `machine-card ${statusClass(m)}`;

        card.innerHTML = `
            <div class="machine-header">
                <div class="machine-name">
                    <span class="dot ${m.status?.toLowerCase()}"></span>
                    <span class="machine-label"></span>
                </div>
                <span class="status-badge ${m.status?.toLowerCase()}"></span>
            </div>

            <div class="machine-image">
                <img src="/images/${id}.png" alt="${id}" />
            </div>

            <div class="machine-meta-container">
                <div class="machine-meta-grid">
                    <div><i class="fa-brands fa-product-hunt" style="color: rgba(116, 192, 252, 1);"></i> </div>
                    <div class="meta-part"></div>
                </div>
                <div class="machine-meta-grid">
                    <div><i class="fa-solid fa-user" style="color: rgba(116, 192, 252, 1);"></i> </div>
                    <div class="meta-operator"></div>
                </div>
            </div>

            <div class="machine-kpi-grid">
                <div class="kpi-box">
                    <div class="kpi-label">Cycle Time</div>
                    <div class="kpi-value cycle-time"></div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-label">Count</div>
                    <div class="kpi-value count-shift"></div>
                </div>
            </div>

            <div class="machine-shift-availability-container">
                <div class="machine-shift-grid">
                    <div class="shift-box"><div class="shift-label">Run</div><div class="shift-value shift-run"></div></div>
                    <div class="shift-box"><div class="shift-label">Idle</div><div class="shift-value shift-idle"></div></div>
                    <div class="shift-box"><div class="shift-label">Alarm</div><div class="shift-value shift-alarm"></div></div>
                    <div class="shift-box"><div class="shift-label">Offline</div><div class="shift-value shift-offline"></div></div>
                </div>
                
                <div class="machine-availability-chart">
                    <div class="availability-label">Availability <i class="fa-solid fa-caret-up" style="color: rgb(116, 192, 252);"></i> Run <i class="fa-solid fa-caret-down" style="color: rgb(236, 39, 39);"></i> Loss</div>
                    <canvas></canvas>
                </div>
            </div>

            <div class="machine-footer"></div>
        `;

        const ctx = card.querySelector('canvas');

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Run', 'Loss'],
                datasets: [{
                    data: [0, 0]
                }]
            },
            options: {
                animation: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            },
            plugins: [centerTextPlugin] 
        });

        availabilityCharts.set(id, chart);

        card.addEventListener('click', () => {
            const [dept, machine] = id.split('_');
            window.location.hash =
                `#production/machine_efficiency?dept=${dept}&machine=${machine}`;
        });

        updateMachineCard(card, id, m);
        return card;
    }

    function updateMachineCard(card, id, m) {
        const run = m.shiftDurations?.run_seconds || 0;
        const idle = m.shiftDurations?.idle_seconds || 0;
        const alarm = m.shiftDurations?.alarm_seconds || 0;
        const offline = m.shiftDurations?.offline_seconds || 0;

        const planned = run + idle + alarm;
        const available = run;
        const notAvailable = planned - run;

        // 🔹 Update classes
        card.className = `machine-card ${statusClass(m)}`;

        // 🔹 Header
        card.querySelector('.machine-label').textContent =
            id.split('_')[1];

        const badge = card.querySelector('.status-badge');
        badge.textContent = m.status ?? '--';
        badge.className = `status-badge ${m.status?.toLowerCase()}`;

        const dot = card.querySelector('.dot');
        dot.className = `dot ${m.status?.toLowerCase()}`;

        // 🔹 Meta
        card.querySelector('.meta-part').textContent =
            m.context?.part_name ?? '--';

        card.querySelector('.meta-operator').textContent =
            m.context?.operator_id ?? '--';

        // 🔹 KPI
        card.querySelector('.cycle-time').textContent =
            `${m.tags?.cycle_time ?? '--'} s`;

        card.querySelector('.count-shift').textContent =
            `${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}`;

        // 🔹 Shift durations
        card.querySelector('.shift-run').textContent =
            formatDuration(run, m.status === 'RUNNING' ? m.statusStartedAt : null);

        card.querySelector('.shift-idle').textContent =
            formatDuration(idle, m.status === 'IDLE' ? m.statusStartedAt : null);

        card.querySelector('.shift-alarm').textContent =
            formatDuration(alarm, m.status === 'ALARM' ? m.statusStartedAt : null);

        card.querySelector('.shift-offline').textContent =
            formatDuration(offline, m.status === 'OFFLINE' ? m.statusStartedAt : null);

        // 🔹 Footer timestamp
        card.querySelector('.machine-footer').textContent =
            `⏱ ${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '--'}`;

        // 🔹 Update chart only
        const chart = availabilityCharts.get(id);
        if (chart) {
            chart.data.datasets[0].data = [available, notAvailable];
            chart.update('none');
        }
    }
} 
export function productionOverviewUnmount() {
 if (unsubscribe) unsubscribe(); 
}


// --------------- Machine Efficiency page --------------- //
let efficiencyUnsubscribe = null; 
let stopwatchInterval = null; 

export function productionMachineEfficiencyView() { 
    return `
    <h1>⚙️ Machine Efficiency</h1> 
    <div class="filter-bar"> 
        <select id="dept-select"> 
            <option value="">Select Department</option> 
        </select> 
    
        <select id="machine-select" disabled> 
            <option value="">Select Machine</option> 
        </select> 
    </div> 
    <section id="selected-machine-card"> </section> 
    <section id="chart-container"> 
        <canvas id="cycleChart"></canvas> 
    </section> 
    `; 
}
export function productionMachineEfficiencyMount(container) { 
    const deptSelect = container.querySelector('#dept-select'); 
    const machineSelect = container.querySelector('#machine-select'); 
    const cardContainer = container.querySelector('#selected-machine-card');

    let selectedId = null; // 🔥 track current machine 
    let chart = null;
    let deepLinkApplied = false;
    function movingAverage(arr, window = 5) {
         const result = []; 
         for (let i = 0; i < arr.length; i++) {
            const size = Math.min(window, i + 1); 
            const slice = arr.slice(i - size + 1, i + 1); 
            const avg = slice.reduce((a, b) => a + b, 0) / size; 
            result.push(avg);
            } 
            return result; 
    } 

    function calculateAvailability(m) {
         if (!m?.shiftDurations) return null;
         const {
            run_seconds = 0, 
            idle_seconds = 0, 
            alarm_seconds = 0 
        } = m.shiftDurations;

        const planned = run_seconds + idle_seconds + alarm_seconds; 
        if (planned === 0) return 0; 
            return ((run_seconds / planned) * 100); 
    }

    function availabilityClass(value) {
        if (value >= 85) return 'kpi-good'; 
        if (value >= 60) return 'kpi-warning'; 
        return 'kpi-bad'; 
    } 
    
    function calculatePerformance(m) {
        if (!m?.shiftDurations) return null; 
        const runTime = m.shiftDurations.run_seconds; 
        const idealCT = m.standard_cycle_time; 
        const totalCount = m.tags?.count_shift ?? 0; 
        if (!runTime || !idealCT) return 0; 
        const performance = (idealCT * totalCount) / runTime * 100; 
        return Math.min(performance, 999); // avoid crazy % 
    } 
    
    function calculateOEE(m) { 
        const availability = calculateAvailability(m); 
        const performance = calculatePerformance(m); 
        if (availability == null || performance == null) return null;
        return (availability / 100) * (performance / 100) * 100; 
    } 

    function renderMachineCard(id, m) {
        if (!m) return;
        const availability = calculateAvailability(m); 
        const performance = calculatePerformance(m); 
        const oee = calculateOEE(m); 
        const aVal = availability?.toFixed(1) ?? '--'; 
        const pVal = performance?.toFixed(1) ?? '--'; 
        const oVal = oee?.toFixed(1) ?? '--'; 
        cardContainer.innerHTML = `
            <div class="machine-card large ${m.status?.toLowerCase()}"> 
                <div class="machine-header"> 
                    <h2>${id.split('_')[1]}</h2> 
                    <span class="shift-label">Shift ${m.shift ?? '--'}</span> 
                </div> <div class="kpi-row-eff"> 
                <div class="kpi-box-eff"> 
                    <div class="kpi-label-eff">Availability</div> 
                    <div class="kpi-value-eff ${kpiClass(availability)}">${aVal}%</div> 
                </div> 
                <div class="kpi-box-eff"> 
                    <div class="kpi-label-eff">Performance</div> 
                        <div class="kpi-value-eff ${kpiClass(performance)}">${pVal}%</div> </div> <div class="kpi-box-eff"> 
                            <div class="kpi-label-eff">OEE</div> <div class="kpi-value-eff ${kpiClass(oee)}">${oVal}%</div> 
                        </div> 
                    </div> 
                </div> 
                `; 
        const history = m.cycleHistory ?? []; 
        const labels = history.map(p => 
            new Date(p.t).toLocaleTimeString() 
        ); 
        const values = history.map(p => p.v); 
        const ma = movingAverage(values, 5); 
        const targetValue = m.standard_cycle_time ?? null; 
        // const targetValue = m.context?.standard_cycle_time ?? null; 
        const targetLine = targetValue 
        ? Array(values.length).fill(targetValue) 
        : []; 
        
        const ctx = document.getElementById('cycleChart'); 
        const maxValue = values.length ? Math.max(...values) : 0; 
        // 🔥 If machine changed → destroy chart 
        if (chart && chart.__machineId !== id) { 
            chart.destroy(); 
            chart = null; 
        } 
        
        if (!chart) {
            chart = new Chart(ctx, {
                type: 'line',
                data: { 
                    labels,
                    datasets: [
                        { 
                            label: 'Cycle Time (s)', 
                            data: values, 
                            borderWidth: 2, 
                            tension: 0.2 
                        }, 
                        { 
                            label: 'MA', 
                            data: ma, 
                            borderWidth: 2, 
                            borderDash: [6,4], 
                            tension: 0.2 
                        }, 
                        targetValue && { 
                            label: 'Target', 
                            data: targetLine, 
                            borderWidth: 2, 
                            borderDash: [4,4], 
                            pointRadius: 0 
                        } 
                    ].filter(Boolean) 
                }, 
                options: { 
                    responsive: true, 
                    animation: false, 
                    interaction: { 
                        mode: 'index', 
                        intersect: false 
                    }, 
                    scales: {
                         y: {
                             beginAtZero: true,
                            max: targetValue 
                            ? targetValue * 1.6 
                            : undefined 
                        } 
                    },
                    plugins: {
                        annotation: {
                            annotations: { 
                                greenZone: { 
                                    type: 'box', 
                                    yMin: 0, 
                                    yMax: targetValue * 1.341, backgroundColor: 'rgba(0,255,0,0.1)', 
                                    borderColor: 'rgba(0,255,0,0.5)' 
                                }, 
                                yellowZone: {
                                    type: 'box', 
                                    yMin: targetValue * 1.341, 
                                    yMax: targetValue * 1.477, 
                                    backgroundColor: 'rgba(255,255,0,0.15)', 
                                    borderColor: 'rgba(255,255,0,0.5)' 
                                }, 
                                 redZone: { 
                                    type: 'box', 
                                    yMin: targetValue * 1.477, 
                                    yMax: targetValue * 1.477 + Math.max(...values) * 1.1, 
                                    backgroundColor: 'rgba(255,0,0,0.08)', 
                                    borderColor: 'rgba(255,0,0,0.5)' 
                                } 
                            } 
                        } 
                    } 
                } 
            }
            ); 
            chart.__machineId = id; // 🔥 track which machine chart belongs to 
            } else {
                 // 🔥 FULL UPDATE
                chart.data.labels = labels; 
                chart.data.datasets[0].data = values; 
                chart.data.datasets[1].data = ma; 
                
                if (targetValue) { 
                    const dynamicMax = Math.max(maxValue * 1.1, targetValue * 1.6); 
                    chart.options.scales.y.max = dynamicMax; 
                    if (!chart.data.datasets[2]) { 
                        chart.data.datasets.push({ 
                            label: 'Target', 
                            data: targetLine, 
                            borderWidth: 2, 
                            borderDash: [4,4], 
                            pointRadius: 0 }); 
                        } else {
                             chart.data.datasets[2].data = targetLine; 
                        } 
                } 
                // 🔥 Update dynamic red zone 
                if (targetValue && chart.options.plugins?.annotation) {
                    const maxValue = Math.max(...values, targetValue); 
                    chart.options.plugins.annotation.annotations.greenZone.yMax = targetValue * 1.341; 
                    chart.options.plugins.annotation.annotations.yellowZone.yMin = targetValue * 1.341; 
                    chart.options.plugins.annotation.annotations.yellowZone.yMax = targetValue * 1.477; 
                    chart.options.plugins.annotation.annotations.redZone.yMin = targetValue * 1.477; 
                    chart.options.plugins.annotation.annotations.redZone.yMax = Math.max(maxValue * 1.1, targetValue * 1.6); } chart.update('none');
                 } 
    } 

    function buildDepartments(state) {
        if (deptSelect.options.length > 1) return;

        const departments = [...new Set( Object.keys(state.machines).map(id => id.split('_')[0]) 
        )]; 
        deptSelect.innerHTML = `
            <option value="">Select Department</option>` + 
        departments.map(d => 
            `<option value="${d}">${d.toUpperCase()}</option>`
        ).join(''); 
    } 

    function updateMachines(state, dept) { 
        machineSelect.innerHTML = `<option value="">Select Machine</option>`;
        machineSelect.disabled = false; 
        
        Object.entries(state.machines) 
        .filter(([id]) => id.startsWith(dept + '_')) 
        .forEach(([id]) => {
            const machine = id.split('_')[1]; 
            machineSelect.innerHTML += `<option value="${machine}">${machine}</option>`; 
            }); 
    } 
    
    // 🔥 Subscribe for LIVE updates 
    efficiencyUnsubscribe = scadaStore.subscribe(state => {

        if (Object.keys(state.machines).length && deptSelect.options.length <= 1) {
            buildDepartments(state);
        }

        if (!deepLinkApplied) {
            const applied = applyDeepLink(state);
            if (applied) deepLinkApplied = true;
        }

        if (!selectedId) return;

        const m = state.machines[selectedId];
        renderMachineCard(selectedId, m);
    });

    // Build initial dropdowns 
    buildDepartments(scadaStore.state); 
    
    deptSelect.addEventListener('change', e => {
        const dept = e.target.value; 
        if (!dept) return; 
        updateMachines(scadaStore.state, dept); 
    }); 
    
    machineSelect.addEventListener('change', e => {
        const machine = e.target.value; 
        const dept = deptSelect.value; 
        
        selectedId = `${dept}_${machine}`; 
        
        const m = scadaStore.state.machines[selectedId]; 
        
        renderMachineCard(selectedId, m); 
    }); 
    
    // 🔥 Handle deep link 
    function applyDeepLink(state) {
        const hash = location.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex === -1) return false;

        const queryString = hash.substring(queryIndex + 1).trim();
        const params = new URLSearchParams(queryString);

        const deptParam = params.get('dept');
        const machineParam = params.get('machine');

        if (!deptParam || !machineParam) return false;

        if (!state.machines[`${deptParam}_${machineParam}`]) {
            return false;
        }

        deptSelect.value = deptParam;
        updateMachines(state, deptParam);

        machineSelect.value = machineParam;
        selectedId = `${deptParam}_${machineParam}`;

        renderMachineCard(selectedId, state.machines[selectedId]);

        return true;
    }
} 
export function productionMachineEfficiencyUnmount() {
    if (efficiencyUnsubscribe) {
        efficiencyUnsubscribe(); 
        efficiencyUnsubscribe = null; 
    } 
    if (stopwatchInterval) { 
        clearInterval(stopwatchInterval); 
        stopwatchInterval = null; 
    } 
}

// ---------------- HISTORY page --------------- //
export function productionProductionHistoryView() {
  return `
    <div class="card">
      <h2>Production History</h2>
    </div>
  `;
}


// ---------------- STAFF MANAGEMENT page --------------- //
export function productionStaffManagementView() {
  return `
    <div class="card">
      <h2>Staff Management</h2>
    </div>
  `;
}
```

### main.css
```css
/* frontend/public/css/main.css */
/* ===== CSS Variables ===== */
:root {
  --primary: #00577D;
  --primary-dark: #003F5C;
  --primary-light: #0A6F9A;

  --sidebar-bg: #0f2f3f;
  --sidebar-hover: rgba(255,255,255,0.08);
  --sidebar-active: #00577D;

  --content-bg: #f3f6fa;
}

/* ===== Global ===== */
body {
  font-family: 'Open Sans', sans-serif;
  margin: 0;
  background: var(--content-bg);
}

/* ===== Header(index.html) ===== */
#topbar {
  height: 60px;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
#logout-btn {
  background: #d32f2f;
  border: none;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
#logout-btn:hover {
  background: #b71c1c;
}
#topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
}
.topbar-center {
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.5px;
}
#footer {
  background: #003F5C;
  color: #fff;
  text-align: center;
  padding: 12px;
  font-size: 13px;
}

/* ============================================= Layout ============================================= */
.layout {
  display: flex;
  height: calc(100vh - 60px);
}



/* ============================================= Sidebar  ============================================= */
/* Standalone: Main sidebar container - works independently */
#sidebar {
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  width: 240px;
  background: var(--sidebar-bg);
  color: #fff;
  transition: width 0.25s ease;
  overflow: hidden;
}
/* Standalone: Sidebar header - works independently */
.sidebar-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
/* Standalone: Toggle button - works independently */
.toggle-sidebar {
  width: 95%;
  height: 90%;
  background:none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

/* ===== Sidebar : Navigation (Hierarchy Levels) ===== */
/* Group: These work together to establish navigation structure */
#leftside-navigation ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
#leftside-navigation li {
  position: relative;
}
#leftside-navigation a {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #cfd8dc;
  text-decoration: none;
  cursor: pointer;
}
#leftside-navigation i {
  min-width: 20px;
  text-align: center;
}
/* Level 1 - Top navigation items */
#leftside-navigation > ul > li > a {
  padding: 14px 18px;
  font-weight: 600;
}
/* Level 2 - First submenu tier */
#leftside-navigation ul ul li > a {
  padding: 10px 42px;
  font-size: 14px;
  font-weight: 500;
}
/* Level 3 - Second submenu tier */
#leftside-navigation ul ul ul li > a {
  padding: 10px 62px;
  font-size: 13px;
}
/* Navigation interactions - hover state */
#leftside-navigation a:hover {
  background: var(--sidebar-hover);
  color: #fff;
}
/* Navigation state - active selection (operator critical) */
#leftside-navigation li.active > a {
  background: var(--sidebar-active);
  color: #fff;
}

/* ===== Sidebar : Submenu Animations ===== */
/* Group: These work together to animate submenu expansion and arrow rotation */
@keyframes dropdown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.sub-menu > ul {
  display: none;
  overflow: hidden;
  animation: dropdown 0.25s ease;
}
.arrow {
  margin-left: auto;
  transition: transform 0.25s ease;
}
.sub-menu > a .arrow {
  margin-left: auto;
  transition: transform 0.25s ease;
}
.sub-menu.active > a .arrow {
  transform: rotate(90deg);
}
li.sub-menu.open > a > .arrow {
  transform: rotate(90deg);
}

/* ===== Sidebar : Collapsed State ===== */
/* Group: These work together to handle collapsed sidebar mode and tooltip display */
.layout.sidebar-collapsed #leftside-navigation span,
.layout.sidebar-collapsed .arrow {
  display: none;
}
.layout.sidebar-collapsed #leftside-navigation a {
  justify-content: center;
  padding: 12px 0;
}
.layout.sidebar-collapsed .sub-menu ul {
  max-height: 0 !important;
  opacity: 0 !important;
}
.layout.sidebar-collapsed #sidebar {
  width: 64px;
}
/* Tooltip - shows on collapsed sidebar hover */
.layout.sidebar-collapsed #leftside-navigation a::after {
  content: attr(data-title);
  position: absolute;
  left: 70px;
  top: 50%;
  transform: translateY(-50%);
  background: #000;
  color: #fff;
  padding: 6px 10px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  border-radius: 4px;
  font-size: 12px;
}
.layout.sidebar-collapsed #leftside-navigation a:hover::after {
  opacity: 1;
}



/* ============================================= Content ============================================= */
#app {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: var(--content-bg);
}
.card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(6px);
  border-radius: 14px;
  padding: 18px;
  margin: 14px 0;
  box-shadow: 0 8px 20px rgba(0,0,0,0.08);
}

/* ===== Content : Production Overview Page ===== */
/* ===== Production Overview Page : Summary Cards ===== */
.summary-wrapper {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(6px);
  border-radius: 14px;
  padding: 10px 10px;
  margin: 0px 0px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.08);
}
.summary-card {
  padding: 5px 5px;
  margin: 0px 10px;
}
.summary-card h3 {
  margin-block-end: 0.5rem;
  margin-block-start: 0.5rem;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  text-align: center;
}
.summary-card canvas {
  height: 200px !important;
}

/* ===== Production Overview Page : Departments header ===== */
.department-section {
  margin-bottom: 2rem;
}
.department-title {
  margin: 1rem 0 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 2px solid #444;
  color: #000000;
  background-image: url(header_press.png);
  background-size: auto 100%;
  background-repeat: no-repeat;
  background-position: right;
}
.department-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* ===== Production Overview Page : Machine Card ===== */
/* Machine Card : Main Body */
.machine-card {
  position: relative;
  border-radius: 14px;
  padding: 16px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
  transition: all 0.25s ease;
  overflow: hidden;
}
/* Hover Lift */
.machine-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 26px rgba(0,0,0,0.18);
}
/* Status Bar Bottom */
.machine-card::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  height: 6px;
  width: 100%;
}
/* Status Styles */
/* RUNNING */
.machine-card.running {
  background: linear-gradient(135deg, #e8f5e9, #ffffff);
  box-shadow: 0 0 18px rgba(46,125,50,0.25);
}
.machine-card.running::before {
  background: #2e7d32;
}
.machine-card.running .kpi-value {
  color: #1b5e20;
}
/* IDLE */
.machine-card.idle {
  background: linear-gradient(135deg, #fff8e1, #ffffff);
  box-shadow: 0 0 18px rgba(249,168,37,0.25);
}
.machine-card.idle::before {
  background: #f9a825;
}
/* ALARM */
.machine-card.alarm {
  background: linear-gradient(135deg, #ffebee, #ffffff);
  animation: pulseAlarm 1.4s infinite;  
}
.machine-card.alarm::before {
  background: #c62828;
}
@keyframes pulseAlarm {
  0% { box-shadow: 0 0 0 rgba(198,40,40,0.3); }
  50% { box-shadow: 0 0 25px rgba(198,40,40,0.5); }
  100% { box-shadow: 0 0 0 rgba(198,40,40,0.3); }
}
/* OFFLINE */
.machine-card.offline {
  background: linear-gradient(135deg, #424242, #2b2b2b);
  color: #ddd;
}
.machine-card.offline::before {
  background: #757575;
}
.machine-card.offline img {
  filter: grayscale(100%) brightness(0.7);
}
.machine-card.offline .kpi-box {
  background: rgba(255,255,255,0.08);
}
/* STOP */
.machine-card.stop {
  background: #eceff1;
}
.machine-card.stop::before {
  background: #607d8b;
}

/* Machine Card : Header (Status dots, Machine name, Status badge) */
.machine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
/* Status Dots */
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
}
.dot.running { background: #2e7d32; }
.dot.idle { background: #f9a825; }
.dot.alarm { background: #c62828; }
.dot.offline { background: #757575; }
.dot.stop { background: #607d8b; }
/* Machine Name */
.machine-name {
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 6px;
}
/* Status Badges */
.status-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  letter-spacing: 0.5px;
}
.status-badge.running {
  background: #2e7d32;
  color: white;
}
.status-badge.idle {
  background: #f9a825;
  color: white;
}
.status-badge.alarm {
  background: #c62828;
  color: white;
}
.status-badge.offline {
  background: #616161;
  color: white;
}
.status-badge.stop {
  background: #78909c;
  color: white;
}

/* Machine Card : Content */
.machine-meta-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  margin-top: 2px;

}
/* Machine Image */
.machine-image {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  object-fit: contain;
}
.machine-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
/* Cycletime - Count */
.machine-kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 5px;
}
/* KPI Box */
.kpi-box {
  background: rgba(0,0,0,0.04);
  padding: 5px;
  border-radius: 8px;
  text-align: center;
}
/* Label */
.kpi-label {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
  margin-bottom: 4px;
}
/* Value */
.kpi-value {
  font-size: 16px;
  font-weight: 700;
}
/* Shifts Duration */
.machine-shift-availability-container{
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 6px;
  margin-top: 5px;

}
.machine-shift-grid {
  /* display: grid;
  grid-template-columns: repeat(2,1fr); */
  gap: 6px;
  margin-top: 0px;
}
.shift-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: rgba(0,0,0,0.04);
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 10px;
  margin: 5px;
}
.shift-label {
  text-align: left;
  opacity: 0.7;
  margin-bottom: 2px;
}
.shift-value {
  text-align: right;
  font-weight: 600;
}
.machine-availability-chart {
  width: 100%;
  height: auto;
  margin: 0;
  justify-items: center;
}
.machine-availability-chart canvas {
  width: auto !important;
  height: 100px !important;
  text-align: center;
}
.availability-label{
  text-align: right;
  font-size: 10px;
  font-weight: 600;
  opacity: 0.7;
  margin-bottom: 2px;
  margin-top: 0px;
}
/*last update */
.machine-footer {
  margin-top: 8px;
  padding-top: 0px;
  /* border-top: 1px solid rgba(0,0,0,0.08); */
  font-size: 12px;
  font-style: italic;
  color: #666;
  display: flex;
  justify-content: flex-end;
}



/* ===== Page Machine efficiency ===== */
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.filter-bar select {
  padding: 8px 12px;
  font-size: 14px;
}

.machine-card.large {
  padding: 0 15px 15px 15px;
  font-size: 16px;
}
.kpi-row-eff {
  display: flex;
  gap: 16px;
  margin-top: 12px;
}

.kpi-box-eff {
  flex: 1;
  background: #ffffff;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  box-shadow: #939393 0px 4px 6px -1px, #000000 0px 2px 4px -1px;
}

.kpi-label-eff {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 4px;
}

.kpi-value-eff {
  font-size: 20px;
  font-weight: bold;
}

.kpi-good {
  color: #00ff88;
}

.kpi-warning {
  color: #ffc107;
}

.kpi-bad {
  color: #ff4d4f;
}

```