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


💓 PLC heartbeat received
💓 PLC heartbeat received
ReferenceError: Cannot access 'alarm' before initialization
    at Object.raise (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\services\alarmService.js:7:15)
    at raiseAlarm (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\services\pythonBridge.js:13:18)
    at Object.stop (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\services\pythonBridge.js:247:3)
    at D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\routes\api\plc.js:27:43
    at Layer.handleRequest (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\node_modules\router\lib\layer.js:152:17)
    at next (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\node_modules\router\lib\route.js:157:13)
    at D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\middleware\requireRole.js:14:5
    at Layer.handleRequest (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\node_modules\router\lib\layer.js:152:17)
    at next (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\node_modules\router\lib\route.js:157:13)
    at Route.dispatch (D:\OneDrive - Sunstar\Documents\GitHub\SCADA-Project\backend\node\node_modules\router\lib\route.js:117:3)
💓 PLC heartbeat received