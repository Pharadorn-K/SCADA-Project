# Machine Monitoring App 📖
It provides:
- A desktop GUI to manage settings (Tkinter).📊
- A Flask web server for dashboards (HTML/CSS/JS).🖥️
- AI module for anomaly detection in machine cycle time.🧠
- MySQL integration for real-time data logging.🗄️

---
# Prepare your computer 🚀
1. Clone the repository
- Place Link to (GitHub desktop) in clone function with URL.
```bash
git clone https://github.com/Sunstar-TH/SCADA-Project.git
```

2. Install requirements pip
- Run this code in your termianl to install all request pip.
```bash
pip install -r requirements.txt
npm install express-session bcryptjs
```

3. Program test run:
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

4. Console check value:
```bash
const m = scadaStore.state.machines['press_AIDA630T'];m.shiftDurations;
scadaStore.state.machines["press_AIDA630T"]
Object.keys(scadaStore.state.machines)
```

5. Generate new hash(user/password)
```bash
node generate-hash.js
```

6. Confirm access PLC and MySQL
- You have to confirm that your computer can access PLC and MySQL before run any functions in program.
```bash
# PLC location
ping 10.207.1.24

#MySQL location
ping 10.207.1.84
```

7. Database for count time in state:
```bash
USE scada;
CREATE TABLE machine_shift_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    shift CHAR(1) NOT NULL,
    department VARCHAR(20) NOT NULL,
    machine VARCHAR(50) NOT NULL,

    run_seconds INT DEFAULT 0,
    idle_seconds INT DEFAULT 0,
    alarm_seconds INT DEFAULT 0,
    offline_seconds INT DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_shift (date, shift, department, machine)
);
```


# Project structure :
scada-project/ 
│ 
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
│   │       ├── db_writer.py            
│   │       └── plc_driver.py           
│   └── node/ 
│       ├── server.js                 
│       ├── package.json 
│       ├── package-lock.json 
│       ├── .env                        
│       ├── node_modules/ ...
│       ├── routes/ 
│       │   └── api/                    
│       │       ├── alam.js
│       │       ├── alamHistory.js   
│       │       ├── audit.js   
│       │       ├── auth.js              
│       │       └── plc.js                     
│       ├── data/ 
│       │   └── systemState.json
│       ├── logs/ 
│       │   └── scada.log
│       ├── middleware/ 
│       │   └── requireRole.js
│       └── services/ 
│           ├── alarmService.js
│           ├── bootstrapEngine.js
│           ├── db.js
│           ├── dbService.js
│           ├── logService.js
│           ├── persistenceEngine.js 
│           ├── plcEngine.js
│           ├── plcMonitor.js 
│           ├── pythonBridge.js
│           ├── shiftEngine.js     
│           ├── stateStore.js
│           └── plcMonitor.js           
│ 
├── frontend/ 
│   ├── public/                        
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── css/
│   │   │   ├── fontawesome/
│   │   │   ├── webfonts/
│   │   │   └── main.css
│   │   ├── images/
│   │   │   ├── Availability.png
│   │   │   ├── Performance.png
│   │   │   ├── OEE.png
│   │   │   ├── heat_DKK1.png
│   │   │   ├── heat_DKK2.png
│   │   │   ├── heat_K3.png
│   │   │   ├── heat_K4.png
│   │   │   ├── heat_K5.png
│   │   │   ├── heat_K6.png
│   │   │   ├── heat_K7.png
│   │   │   ├── lathe_Rotor TK1.png
│   │   │   ├── heat_Rotor TK4.png
│   │   │   ├── press_AIDA630T.png
│   │   │   └── press_M-20id-25.png
│   │   └── js/
│   │       ├── api.js
│   │       ├── app.js
│   │       ├── routes.js
│   │       ├── sidebar-behavior.js
│   │       ├── sidebar.js
│   │       ├── store.js
│   │       ├── storeSelectors.js
│   │       └── views/
│   │           ├── admin.js            
│   │           ├── home.js
│   │           ├── maintenance.js
│   │           ├── oee.js
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



# Let's take a look at current version and how conut on state work
## fist, as I said before I already create table for keep count time in each status only:
```sql
USE scada;
CREATE TABLE machine_shift_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    shift CHAR(1) NOT NULL,
    department VARCHAR(20) NOT NULL,
    machine VARCHAR(50) NOT NULL,

    run_seconds INT DEFAULT 0,
    idle_seconds INT DEFAULT 0,
    alarm_seconds INT DEFAULT 0,
    offline_seconds INT DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_shift (date, shift, department, machine)
);
```

## then from these files:
```javaScript
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
logService.loadFromFile(10);
const alarmService = require('./services/alarmService');
global.services.alarmService = alarmService;

// Import services
const plcRoutes = require('./routes/api/plc');
// const setupWebsocket = require('./routes/websocket');
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

// Initialize state store
async function bootstrap() {
  console.log('🔄 Hydrating state from database...');
  await global.services.stateStore.hydrateFromDatabase();
  console.log('✅ Hydration complete');

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocket.Server({ server });

  global.services.wss = wss;

  const pythonBridge = require('./services/pythonBridge');
  const plcMonitor = require('./services/plcMonitor');

  plcMonitor.setWss(wss);

  global.services.pythonBridge = pythonBridge;
  global.services.plcMonitor = plcMonitor;

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

```javaScript
// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const STATE_FILE = path.join(__dirname, '../data/systemState.json');

let dbPool = null;
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

function updatePlc(payload) {
  const { department, machine, machine_type, timestamp, metrics = {}, context = {} } = payload;
  if (!department || !machine) return;
  // 🔥 TEMP STANDARD CYCLE TIME CONFIG
  const STANDARD_CYCLE_TIME = {
    press: 6.5,
    heat: 95,
    lathe: 90
  };

  const key = `${department.toLowerCase()}_${machine}`;
  const prev = runtimeState.plc[key] || {};


  // 🆕 handle cycle history (TIME WINDOW BASED)
  let cycleHistory = prev.cycleHistory || [];

  // 🔥 If hydrating from DB
  if (payload.__hydratedHistory) {
    cycleHistory = payload.__hydratedHistory;
  }

  if (metrics.cycle_time !== undefined && metrics.cycle_time > 0) {

    const point = {
      t: new Date(timestamp).getTime(),
      v: metrics.cycle_time
    };

    cycleHistory = [...cycleHistory, point];

    // ⏱ Keep only last 5 minutes
    const MAX_POINTS = 50;

    if (cycleHistory.length > MAX_POINTS) {
      cycleHistory = cycleHistory.slice(-MAX_POINTS);
    }

  }

  const statusMap = {
    RUNNING: 'run_seconds',
    IDLE: 'idle_seconds',
    ALARM: 'alarm_seconds',
    OFFLINE: 'offline_seconds'
  };  
  const now = Date.now();
  const newStatus = deriveStatus(department, metrics);
  
  let durations = prev.shiftDurations ?? {
    run_seconds: 0,
    idle_seconds: 0,
    alarm_seconds: 0,
    offline_seconds: 0
  };

  const prevStatus = prev.status;
  const prevStart = prev.statusStartedAt ?? now;

  // 🔥 ALWAYS accumulate previous state
  if (prevStatus) {
    const diff = Math.floor((now - prevStart) / 1000);
    const bucket = statusMap[prevStatus];

    if (bucket) {
      durations[bucket] += diff;
    }
  }

  const shiftInfo = getShiftInfo(now);

  // 🔥 If shift changed → reset durations
  if (
    prev.shift !== shiftInfo.shift ||
    prev.shiftDate !== shiftInfo.date
  ) {
    durations = {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };
  }


  runtimeState.plc[key] = {
    ...prev,
    department,
    machineType: machine_type,
    status: newStatus,
    
    statusStartedAt: now,

    shift: shiftInfo.shift,
    shiftDate: shiftInfo.date,
    shiftDurations: durations,

    timestamp: new Date(timestamp).getTime(),
    lastUpdate: Date.now(),
    standard_cycle_time:STANDARD_CYCLE_TIME[department?.toLowerCase()] ?? null,
    context: {
      ...prev.context,
      operator_id: context.operator_id ?? prev.context?.operator_id ?? null,
      part_name: context.part_name ?? prev.context?.part_name ?? null,
      plan: context.plan ?? prev.context?.plan ?? null
    },

    tags: {
      ...prev.tags,
      ...(metrics.cycle_time !== undefined && {
        cycle_time: metrics.cycle_time
      }),
      ...(metrics.count_shift !== undefined && {
        count_shift: metrics.count_shift
      })
    },

    cycleHistory, // 👈 ADD THIS

    alarms: metrics.alarm ? [metrics.alarm_code] : []
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

function getShiftInfo(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  let shift;

  if (hour >= 6 && hour < 14) shift = 'A';
  else if (hour >= 14 && hour < 22) shift = 'B';
  else shift = 'C';

  // Shift date handling (very important for shift C)
  let shiftDate = new Date(date);

  if (shift === 'C' && hour < 6) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return {
    shift,
    date: shiftDate.toISOString().slice(0, 10) // YYYY-MM-DD
  };
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

/* ------------------ DB ------------------ */
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

      // Optional per department
      heat: row.heat ?? 0,
      setting: row.setting ?? 0
    }
  };
}

async function hydrateFromDatabase() {
  const pool = await getDbPool();

  const departments = [
    { table: 'raw_press' },
    { table: 'raw_heat' },
    { table: 'raw_lathe' }
  ];

  for (const { table } of departments) {
    console.log(`🔄 Hydrating from ${table}...`);

    // Get distinct machines first
    const [machines] = await pool.query(
      `SELECT DISTINCT machine FROM ${table}`
    );

    for (const m of machines) {
      const machine = m.machine;
      // Smart ordering:
      const [rows] = await pool.query(
        `
        SELECT *
        FROM ${table}
        WHERE machine = ?
        ORDER BY id_row DESC
        LIMIT 1
        `,
        [machine]
      );
      
      // Load last 30 cycle_time history
      const [cycleRows] = await pool.query(
        `
        SELECT timestamp, cycle_time
        FROM ${table}
        WHERE machine = ?
          AND count_signal = 1
          AND cycle_time > 0
        ORDER BY id_row DESC
        LIMIT 30
        `,
        [machine]
      );

      if (!rows.length) continue;

      const normalized = normalizeRow(rows[0]);
      const history = cycleRows
        .reverse() // oldest → newest
        .map(r => ({
          t: new Date(r.timestamp).getTime(),
          v: r.cycle_time
        }));

      // update latest machine state
      updatePlc({
        ...normalized,
        __hydratedHistory: history
      });

      // update shift durations
      const shiftInfo = getShiftInfo();

      const [shiftRows] = await pool.query(
        `
        SELECT run_seconds, idle_seconds,
              alarm_seconds, offline_seconds
        FROM machine_shift_status
        WHERE date = ?
          AND shift = ?
          AND department = ?
          AND machine = ?
        `,
        [
          shiftInfo.date,
          shiftInfo.shift,
          normalized.department,
          normalized.machine
        ]
      );

      if (shiftRows.length) {
        const machineKey = `${normalized.department.toLowerCase()}_${normalized.machine}`;
        runtimeState.plc[machineKey].shiftDurations = {
          run_seconds: shiftRows[0].run_seconds,
          idle_seconds: shiftRows[0].idle_seconds,
          alarm_seconds: shiftRows[0].alarm_seconds,
          offline_seconds: shiftRows[0].offline_seconds
        };
      }
    }

  }
  console.log('✅ State hydration complete');
}
async function saveShiftDurations() {
  const pool = await getDbPool();

  for (const [key, machine] of Object.entries(runtimeState.plc)) {

    if (!machine.shiftDurations) continue;

    const now = Date.now();
    const diff = Math.floor((now - machine.statusStartedAt) / 1000);

    const statusMap = {
      RUNNING: 'run_seconds',
      IDLE: 'idle_seconds',
      ALARM: 'alarm_seconds',
      OFFLINE: 'offline_seconds'
    };

    const bucket = statusMap[machine.status];
    if (bucket) {
      machine.shiftDurations[bucket] += diff;
      machine.statusStartedAt = now;
    }

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
        key.split('_')[1],
        machine.shiftDurations.run_seconds,
        machine.shiftDurations.idle_seconds,
        machine.shiftDurations.alarm_seconds,
        machine.shiftDurations.offline_seconds
      ]
    );
  }
}

setInterval(saveShiftDurations, 1 * 60 * 1000);    

module.exports = {
  updatePlc,
  getPlcSnapshot,
  getPlc,
  loadState,
  saveState,
  hydrateFromDatabase
};

```

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

```javaScript
// frontend/public/js/views/production.js 
import { scadaStore } from '../store.js'; 
const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding']; 


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


// ---------------- Overview Page ---------------- // 
let unsubscribe = null; 
export function productionOverviewMount(container) {
    const plantId = 'plant1'; 
    const cardMap = new Map(); // machineId → DOM element 
        let initialized = false; 
    container.innerHTML = `
        <h1>🏭 Production Overview</h1> 
        <section id="shift-summary" class="shift-summary"></section> 
        <section id="machine-grid" class="machine-grid"></section> 
    `;
    const grid = container.querySelector('#machine-grid');
    const summaryEl = container.querySelector('#shift-summary');

    function statusClass(machine) {
        if (machine.status === 'OFFLINE') return 'offline'; 
        if (machine.alarms?.length) return 'alarm'; 
        return machine.status?.toLowerCase() || 'idle'; 
    }

    // why count shift don't show in overview?
    unsubscribe = scadaStore.subscribe(state => {
        const machines = Object.entries(state.machines); 
        const groups = {}; 
        const summary = calculateShiftSummary(state); 
        
        summaryEl.innerHTML =`
            <div class="summary-grid"> 
                <div class="summary-box"> 
                    Availability 
                    <span class="${kpiClass(summary.availability)}"> ${summary.availability.toFixed(1)}% </span> 
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
        } 
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

    function createMachineCard(id, m) {
        const card = document.createElement('div'); 
        card.className = `machine-card ${statusClass(m)}`; 
        
        card.addEventListener('click', () => {
            const [dept, machine] = id.split('_'); 
            window.location.hash = `#production/machine_efficiency?dept=${dept}&machine=${machine}`; 
        }); 
        updateMachineCard(card, id, m); 
        return card; 
    } 

    function updateMachineCard(card, id, m) {
        card.className = `machine-card ${statusClass(m)}`; 
        card.innerHTML = `
            <div class="machine-header"> 
                <div class="machine-name"> 
                    <span class="dot ${m.status?.toLowerCase()}"></span> 
                    ${id.split('_')[1]} 
                </div> 
                <span class="status-badge ${m.status?.toLowerCase()}"> ${m.status ?? '--'} </span> 
            </div> 
            <div class="machine-image"> 
                <img src="/images/${id}.png" alt="${id}" /> 
            </div> 
            <div class="machine-meta"> 
                <div><i class="fa-brands fa-product-hunt" style="color: rgba(116, 192, 252, 1);"></i> ${m.context?.part_name ?? '--'}</div> 
                <div><i class="fa-solid fa-user" style="color: rgba(116, 192, 252, 1);"></i> ${m.context?.operator_id ?? '--'}</div> 
            </div> 

            <div class="machine-kpi-grid"> 
                <div class="kpi-box"> 
                    <div class="kpi-label">Cycle Time</div> 
                    <div class="kpi-value"> 
                        ${m.tags?.cycle_time ?? '--'} s 
                    </div>
                </div> 
                <div class="kpi-box"> 
                    <div class="kpi-label">Count</div> 
                    <div class="kpi-value"> 
                        ${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'} 
                    </div> 
                </div> 
            </div> 
            
            <div class="machine-footer"> 
                ⏱ ${ 
                m.timestamp 
                ? new Date(m.timestamp).toLocaleTimeString() 
                : '--' 
                } 
            </div> 
        `; 
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

    stopwatchInterval = setInterval(() => {
        const now = Date.now(); 
        Object.entries(scadaStore.state.machines) 
        .forEach(([id, m]) => {
            if (!m.shiftDurations) return;
             const diff = Math.floor( 
                (now - m.statusStartedAt) / 1000 
            ); 
            
            const bucketMap = { 
                RUNNING: 'run_seconds', 
                IDLE: 'idle_seconds', 
                ALARM: 'alarm_seconds', 
                OFFLINE: 'offline_seconds' 
            }; 
            const bucket = bucketMap[m.status];
            const base = m.shiftDurations[bucket] ?? 0;
            const total = base + diff; 
            // update DOM text 
        }); 
    }, 1000); 
    
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


## what I struggling here is:
### 1. I see strange behavior when shift change and create new row in data base
### after I fresh lanch sever,I leave it for a day then I take a look at data base ()
```sql
SELECT * FROM scada.machine_shift_status order by id desc;
```
### seem like this is the rows that created when I first start sever. date is 2026-02-22 but actually I start it in 2026-02-22
11760	2026-02-22	A	Lathe	Rotor TK4	5	0	0	1066	2026-02-23 06:54:47	2026-02-23 07:11:47
11759	2026-02-22	A	Lathe	Rotor TK1	5	0	0	1066	2026-02-23 06:54:47	2026-02-23 07:11:47
11758	2026-02-22	A	Heat	K6	0	0	0	87466	2026-02-23 06:54:47	2026-02-24 07:13:21
11757	2026-02-22	A	Heat	K5	0	0	0	87475	2026-02-23 06:54:47	2026-02-24 07:13:21
11756	2026-02-22	A	Heat	K8	5	946	0	0	2026-02-23 06:54:47	2026-02-23 07:09:47
11755	2026-02-22	A	Heat	DKK1	5	410	0	0	2026-02-23 06:54:47	2026-02-23 07:00:47
11754	2026-02-22	A	Heat	K4	5	528	0	0	2026-02-23 06:54:47	2026-02-23 07:02:47
11753	2026-02-22	A	Heat	K7	5	946	0	0	2026-02-23 06:54:47	2026-02-23 07:09:47
11752	2026-02-22	A	Heat	K3	5	528	0	0	2026-02-23 06:54:47	2026-02-23 07:02:47
11751	2026-02-22	A	Heat	DKK2	5	409	0	0	2026-02-23 06:54:47	2026-02-23 07:00:47
11750	2026-02-22	A	Press	M-20id-25	0	351	0	5	2026-02-23 06:54:47	2026-02-23 06:59:47
11749	2026-02-22	A	Press	AIDA630T	193	140	0	5	2026-02-23 06:54:47	2026-02-23 06:59:47

### this is the next row it auto create too and seem like the date is correct now but seem like time count in this group not increase correctly 
### and why these created about 07:00 not 06:00
11976	2026-02-23	A	Lathe	Rotor TK4	0	0	1016	0	2026-02-23 07:12:47	2026-02-24 07:13:21
11975	2026-02-23	A	Lathe	Rotor TK1	153	0	0	0	2026-02-23 07:12:47	2026-02-24 07:00:21
11948	2026-02-23	A	Heat	K8	231	0	0	0	2026-02-23 07:10:47	2026-02-24 07:00:21
11945	2026-02-23	A	Heat	K7	231	0	0	0	2026-02-23 07:10:47	2026-02-24 07:00:21
11862	2026-02-23	A	Heat	K4	0	699	16	0	2026-02-23 07:03:47	2026-02-24 07:08:21
11860	2026-02-23	A	Heat	K3	716	0	0	0	2026-02-23 07:03:47	2026-02-24 07:08:21
11839	2026-02-23	A	Heat	DKK1	171	0	0	0	2026-02-23 07:01:47	2026-02-24 06:59:21
11835	2026-02-23	A	Heat	DKK2	160	0	70	0	2026-02-23 07:01:47	2026-02-24 07:00:21
11822	2026-02-23	A	Press	M-20id-25	0	237	0	0	2026-02-23 07:00:47	2026-02-24 07:00:21
11821	2026-02-23	A	Press	AIDA630T	158	0	0	0	2026-02-23 07:00:47	2026-02-24 06:59:21

### these groub created next around 14:00 it's seem great because shift B start around here 14:00
### but why it do not created at 14:00 immediately
### and why its still update to this row even day change
16613	2026-02-23	B	Heat	K7	60007	0	0	0	2026-02-23 14:12:33	2026-02-24 06:56:21
16550	2026-02-23	B	Press	M-20id-25	0	1843	0	58661	2026-02-23 14:07:33	2026-02-24 06:56:21
16488	2026-02-23	B	Lathe	Rotor TK4	0	0	60813	29	2026-02-23 14:01:33	2026-02-24 06:56:21
16475	2026-02-23	B	Lathe	Rotor TK1	58139	736	1936	74	2026-02-23 14:00:33	2026-02-24 06:57:21
16472	2026-02-23	B	Heat	K8	60665	0	0	0	2026-02-23 14:00:33	2026-02-24 06:56:21
16471	2026-02-23	B	Heat	DKK1	60541	57	28	0	2026-02-23 14:00:33	2026-02-24 06:56:21
16470	2026-02-23	B	Heat	K4	59475	0	1246	0	2026-02-23 14:00:33	2026-02-24 06:56:21
16468	2026-02-23	B	Heat	K3	60560	108	0	0	2026-02-23 14:00:33	2026-02-24 06:56:21
16467	2026-02-23	B	Heat	DKK2	60623	0	28	0	2026-02-23 14:00:33	2026-02-24 06:56:21
16465	2026-02-23	B	Press	AIDA630T	1869	267	0	58679	2026-02-23 14:00:33	2026-02-24 06:56:21

### I don't know why shift C won't created

### this is days 2 that sever run never stop.
### these is the next group that created may be it's because I leave comeputer over night the computer goes to sleep mode that why row have created at this time that I open computer again, I not sure.  
18654	2026-02-24	A	Heat	K4	7	0	254	0	2026-02-24 07:09:21	2026-02-24 07:13:21
18652	2026-02-24	A	Heat	K3	0	0	254	0	2026-02-24 07:09:21	2026-02-24 07:13:21
18563	2026-02-24	A	Lathe	Rotor TK1	741	0	0	0	2026-02-24 07:01:21	2026-02-24 07:13:21
18560	2026-02-24	A	Heat	K8	684	0	69	0	2026-02-24 07:01:21	2026-02-24 07:13:21
18557	2026-02-24	A	Heat	K7	663	0	89	0	2026-02-24 07:01:21	2026-02-24 07:13:21
18555	2026-02-24	A	Heat	DKK2	605	0	113	0	2026-02-24 07:01:21	2026-02-24 07:13:21
18554	2026-02-24	A	Press	M-20id-25	0	753	0	0	2026-02-24 07:01:21	2026-02-24 07:13:21
18547	2026-02-24	A	Heat	DKK1	773	0	0	0	2026-02-24 07:00:21	2026-02-24 07:13:21
18541	2026-02-24	A	Press	AIDA630T	540	200	0	0	2026-02-24 07:00:21	2026-02-24 07:13:21


### you will see K5-K6 that offline all the time because machine is instaling won't created again.
### it should created new row for every machine immediately when shift changed and can handle even machine that never changed status again after start.
### for now I use 1 * 60 * 1000 just to see are datas save correctly, Real thing should be save when new row immediately created too

# for now this is my current backend 
scada-project/ 
│ 
├── backend/ 
│   ├── python/ 
│   │   ├── __pycache__/
│   │   ├── __init__.py 
│   │   ├── plc_service.py              
│   │   ├── plc_loop.py                 
│   │   └── utils/
│   │       ├── __pycache__/
│   │       ├── clean_data.py
│   │       ├── db_connector.py
│   │       ├── plc_driver.py          
│   │       └── db_writer.py            
│   └── node/ 
│       ├── server.js                 
│       ├── package.json 
│       ├── package-lock.json 
│       ├── .env                        
│       ├── node_modules/ ...
│       ├── routes/ 
│       │   └── api/                    
│       │       ├── alam.js
│       │       ├── alamHistory.js   
│       │       ├── audit.js   
│       │       ├── auth.js              
│       │       └── plc.js                     
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
│           ├── persistenceEngine.js 
│           ├── plcEngine.js 
│           ├── shiftEngine.js   
│           ├── pythonBridge.js          
│           └── plcMonitor.js           
│ 
├── frontend/ 


.
.

# My scada project have structure folder like this:
## Project structure :
```bash
scada-project/ 
│ 
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
│   │       ├── db_writer.py            
│   │       └── plc_driver.py           
│   └── node/ 
│       ├── server.js                 
│       ├── package.json 
│       ├── package-lock.json 
│       ├── .env                        
│       ├── node_modules/ ...
│       ├── routes/ 
│       │   └── api/                    
│       │       ├── alam.js
│       │       ├── alamHistory.js   
│       │       ├── audit.js   
│       │       ├── auth.js              
│       │       └── plc.js                     
│       ├── data/ 
│       │   └── systemState.json
│       ├── logs/ 
│       │   └── scada.log
│       ├── middleware/ 
│       │   └── requireRole.js
│       └── services/ 
│           ├── alarmService.js
│           ├── bootstrapEngine.js
│           ├── db.js
│           ├── dbService.js
│           ├── logService.js
│           ├── persistenceEngine.js 
│           ├── plcEngine.js
│           ├── plcMonitor.js 
│           ├── pythonBridge.js
│           ├── shiftEngine.js     
│           ├── stateStore.js
│           └── plcMonitor.js           
│ 
├── frontend/ 
│   ├── public/                        
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── css/
│   │   │   ├── fontawesome/
│   │   │   ├── webfonts/
│   │   │   └── main.css
│   │   ├── images/
│   │   │   ├── Availability.png
│   │   │   ├── Performance.png
│   │   │   ├── OEE.png
│   │   │   ├── heat_DKK1.png
│   │   │   ├── heat_DKK2.png
│   │   │   ├── heat_K3.png
│   │   │   ├── heat_K4.png
│   │   │   ├── heat_K5.png
│   │   │   ├── heat_K6.png
│   │   │   ├── heat_K7.png
│   │   │   ├── lathe_Rotor TK1.png
│   │   │   ├── heat_Rotor TK4.png
│   │   │   ├── press_AIDA630T.png
│   │   │   └── press_M-20id-25.png
│   │   └── js/
│   │       ├── api.js
│   │       ├── app.js
│   │       ├── routes.js
│   │       ├── sidebar-behavior.js
│   │       ├── sidebar.js
│   │       ├── store.js
│   │       ├── storeSelectors.js
│   │       └── views/
│   │           ├── admin.js            
│   │           ├── home.js
│   │           ├── maintenance.js
│   │           ├── oee.js
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
### Next I will show you all of code that I have then we will develop it.
### if you under stand reply "OK"

## Backend side 
```bash

```

```bash

```

```bash

```

```bash

```
## Frontend side      
```bash

```

```bash

```

```bash

```

```bash

```