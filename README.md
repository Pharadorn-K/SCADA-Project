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
│   │   │   ├── fontawesome/
│   │   │   ├── webfonts/
│   │   │   └── main.css
│   │   └── js/
│   │       ├── app.js
│   │       ├── api.js
│   │       ├── sidebar.js
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
│   │   └── js/
│   │       ├── app.js
│   │       ├── api.js
│   │       ├── sidebar.js
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

<!-- // frontend/public/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SCADA.SET</title>
    <link rel="stylesheet" href="/css/fontawesome/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
  </head>
  <body>
    <header id="topbar">
      <div class="topbar-left">
        <h1>SCADA.SET</h1>
      </div>

      <div class="topbar-right">
        <span id="user-role"></span>
        <button id="logout-btn">Logout <i class="fa-solid fa-right-to-bracket fa-flip-horizontal"></i></i></button>
      </div>
      <button id="sidebar-toggle"><i class="fa-solid fa-house-signal" style="font-size: 24px;"></i></button>
    </header>

    <div class="layout">
      <aside id="sidebar"></aside>
      <main id="app" class="page"></main>
    </div>
    
    <script type="module" src="/js/app.js"></script>
  </body>
</html>

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

// frontend/public/js/app.js
import { homeView, homeMount, homeUnmount } from './views/home.js';
import { productionView, productionMount, productionUnmount } from './views/production.js';
import { maintenanceView, maintenanceMount, maintenanceUnmount } from './views/maintenance.js';
import { adminView, adminMount, adminUnmount } from './views/admin.js';
import { renderSidebar } from './sidebar.js';

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

function mountSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = renderSidebar(currentUserRole);

  sidebar.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-page]');
    if (!link) return;

    e.preventDefault();
    navigate(link.dataset.page);
  });
}

function setActiveSidebar(page) {
  document.querySelectorAll('#sidebar a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

function initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  const layout = document.querySelector('.layout');

  btn.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');

    // Optional: remember state
    localStorage.setItem(
      'sidebar-collapsed',
      layout.classList.contains('sidebar-collapsed')
    );
  });

  // Restore state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
  }
}

// // Main router
export async function navigate(page) {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;
  setActiveSidebar(page);
  if (currentUnmount) currentUnmount();

  const app = document.getElementById('app');

  // 🔥 RESET page classes
  app.className = 'page';

  switch (page) {
    case 'home':
      app.classList.add('page-home');
      app.innerHTML = homeView();
      homeMount?.();
      currentUnmount = homeUnmount;
      break;

    case 'production':
      app.classList.add('page-production');
      app.innerHTML = productionView();
      productionMount?.();
      currentUnmount = productionUnmount;
      break;

    case 'maintenance':
      app.classList.add('page-maintenance');
      app.innerHTML = maintenanceView();
      maintenanceMount?.();
      currentUnmount = maintenanceUnmount;
      break;

    case 'admin':
      if (currentUserRole !== 'admin') {
        alert('Access denied');
        return;
      }
      app.classList.add('page-admin');
      app.innerHTML = adminView();
      adminMount?.();
      currentUnmount = adminUnmount;
      break;

    default:
      navigate('home');
  }
}

async function bootstrap() {
  const ok = await checkAuth();
  if (!ok) return;

  initWebSocket();
  mountTopbar();
  mountSidebar();
  initSidebarToggle();
  navigate('home');
}

bootstrap();


// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  // Restore page from URL hash or default to home
  const page = window.location.hash.slice(1) || 'home';
  navigate(page);
});

// frontend/public/js/sidebar.js
export function renderSidebar(role) {
  return `
    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <a data-page="home"><i class="fa-solid fa-display"></i></i> <span>Home</span></a>
        <a data-page="production"><i class="fa-solid fa-industry"></i> <span>Production</span></a>
        <a data-page="maintenance"><i class="fa-solid fa-screwdriver-wrench"></i> <span>Maintenance</span></a>

      </div>

      ${role === 'admin' ? `
      <div class="sidebar-section">
        <a data-page="admin"><i class="fa-solid fa-laptop-code"></i><span>    Admin</span></a>
      </div>` : ''}
    </nav>
  `;
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

export function adminUnmount() {
  if (alarmTimer) clearInterval(alarmTimer);
}

// frontend/public/js/views/home.js
export function homeView() {
  return `
      <h1>🏭 SCADA Dashboard – Home</h1>
      <div class="card">
        <p>Welcome to the SCADA system.</p>
        <p>Use navigation above to switch views.</p>
        <p><i class="fasfa-desktop"></i> fontawesome</p>
      </div>
  `;
}

export function homeMount() {
}

export function homeUnmount() {
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

// frontend/public/js/views/production.js
export function productionView() {
  return `
    <h2>🏭 Production Monitoring</h2>

    <div class="card">
      <h3>📡 Live PLC Data</h3>
      <pre id="plc-data">No data...</pre>
    </div>

  `;
}
import { scadaStore } from '../store.js';

let unsubscribe = null;

export async function productionMount() {
  const dataEl = document.getElementById('plc-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });

}

export function productionUnmount() {
  if (unsubscribe) unsubscribe();
}

/* frontend/public/css/main.css */
/* ===== Page Wrapper ===== */

.page {
  min-height: calc(100vh - 60px);
  padding: 20px;
  background-color: #4ee298;
}

.page .card {
  background: white;
}

.page-home {
  color: #d32f2f;
}
.page-production {
  color: #4caf50;
}
.page-maintenance {
  color: #ff9800;
}
.page-admin {
  color: #1976d2;
}

/* Admin page tweaks */
.page-admin .card {
  border-left: 4px solid #b319d2;
}

/* Production page tweaks */
.page-production .card {
  border-left: 4px solid #4caf50;
}

body {
    font-family: sans-serif;
    margin: 0;
    background: #345cff;
}

/* ===== Header ===== */
#topbar {
  height: 60px;
  background: #19537B;
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

/* ===== Layout ===== */
.layout {
  display: flex;
  min-height: calc(100vh - 60px);
}

/* ===== Sidebar ===== */
#sidebar {
  width: 220px;
  background: #19537B;
  color: #fff;
}

.sidebar-nav {
  padding: 16px;
}

.sidebar-section {
  margin-bottom: 20px;
}

#sidebar a {
  display: block;
  padding: 10px 12px;
  color: #ddd;
  text-decoration: none;
  border-radius: 6px;
}

#sidebar a.active {
  background: #3f51b5;
  color: #fff;
  font-weight: 600;
}

#sidebar a:hover {
  background: #2c2c44;
  color: #fff;
}

.layout.sidebar-collapsed #sidebar {
  width: 60px;
}

.layout.sidebar-collapsed #sidebar a span {
  display: none;
}

.layout.sidebar-collapsed #app {
  margin-left: 10px;
}

#sidebar {
  transition: width 0.2s ease;
}

/* ===== Content ===== */
#app {
  flex: 1;
  background: #f5f6fa;
}

