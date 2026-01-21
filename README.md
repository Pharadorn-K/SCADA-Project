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


first let's take a look at frontend associated files.
flow structure:
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

