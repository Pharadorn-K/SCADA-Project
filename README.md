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
│       ├── .env                        # 🗝️ Config (PORT, PLC_IP, DB_URL, etc.) 
│       ├── node_modules/ ...
│       ├── routes/ 
│       │   ├── api/                    # REST endpoints (e.g., /api/plc/start) 
│       │   │   ├── auth.js              # ✅ Combines read/write/start/stop (cleaner than split files) 
│       │   │   └── plc.js              # ✅ Combines read/write/start/stop (cleaner than split files) 
│       │   └── websocket.js            # 🔄 WS message handler (e.g., broadcast PLC data) 
│       └── services/ 
│           ├── pythonBridge.js         # ✅ Renamed (camelCase), uses child_process or TCP socket to Python 
│           ├── dbService.js            # 🔌 DB connector (e.g., pg, mysql2) 
│           └── plcMonitor.js           # 📡 Manages active PLC state & WebSocket broadcast 
│ 
├── frontend/ 
│   ├── dist/   
│   ├── public/                         # Static assets (no build needed) 0824809631
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── css/
│   │   │   └── main.css
│   │   └── js/
│   │       ├── app.js          // router & navigation
│   │       ├── views/            
│   │       │   ├── home.js
│   │       │   ├── production.js
│   │       │   ├── maintenance.js
│   │       │   └── admin.js
│   │       └── api.js          // HTTP wrappers
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

and this flow :
               +---------------------------+
               |        Frontend           |
               |  HTML Dashboard (WS)      |
               +-------------+-------------+
                             |
                             | WebSocket (real-time only)
                             v
                     +-------+--------+
                     |    Node.js     |
Frontend → Node API  |  (controller)  | → Python: start/stop/write PLC
                     +-------+--------+
                             ^
              TCP/Socket     |
                             |
                     +-------+--------+
                     |    Python      |
                     | PLC Loop 1 sec |
                     |   + DB Writer  |
                     +-------+--------+
                             |
                             | Ethernet
                             v
                           PLC

I will show you the code in each file I have and then we will start code for next step. if you understand just answer "OK".



<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Sidebar Navigation</title>

  <!-- Open Sans Font -->
  <link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,700" rel="stylesheet">

  <!-- Font Awesome 4.0.3 -->
  <link href="//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.min.css" rel="stylesheet">

  <style>
    body {
      color: #5D5F63;
      background: #ffffff;
      font-family: 'Open Sans', sans-serif;
      padding: 0;
      margin: 0;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    .sidebar-toggle {
      margin-left: -240px;
    }

    .sidebar {
      width: 240px;
      height: 100%;
      background: #293949;
      position: absolute;
      transition: all 0.3s ease-in-out;
      z-index: 100;
    }
	.header-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #293949; 
      margin: 0px; 
      color: #ffffff;
      padding: 10px 20px;
      
    }
	.header-head {
      color: #ffffff;
    }
    #leftside-navigation ul,
    #leftside-navigation ul ul {
      margin: -2px 0 0;
      padding: 0;
    }

    #leftside-navigation ul li {
      list-style-type: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    #leftside-navigation ul li.active > a {
      color: #1abc9c;
    }

    #leftside-navigation ul li.active ul {
      display: block;
    }

    #leftside-navigation ul li a {
      color: #aeb2b7;
      text-decoration: none;
      display: block;
      padding: 18px 0 18px 25px;
      font-size: 12px;
      outline: 0;
      transition: all 200ms ease-in;
    }

    #leftside-navigation ul li a:hover {
      color: #1abc9c;
    }

    #leftside-navigation ul li a span {
      display: inline-block;
    }

    #leftside-navigation ul li a i {
      width: 20px;
    }

    #leftside-navigation ul li a i.fa-angle-left,
    #leftside-navigation ul li a i.fa-angle-right {
      padding-top: 3px;
    }

    /* Submenu styles */
    #leftside-navigation ul ul {
      display: none;
    }

    #leftside-navigation ul ul li {
      background: #23313f;
      margin-bottom: 0;
      margin-left: 0;
      margin-right: 0;
      border-bottom: none;
    }

    #leftside-navigation ul ul li a {
      font-size: 12px;
      padding-top: 13px;
      padding-bottom: 13px;
      color: #aeb2b7;
    }

  </style>
</head>
<body>
<header class="header-main">
	<h1 class="header-head">SCADA.SET</h1>
    <a href="#" onclick="logout()">🚪 Logout</a>
</header>
<aside class="sidebar">
  <div id="leftside-navigation" class="nano">
    <ul class="nano-content">
      <li>
        <a href="index.html"><i class="fa fa-dashboard"></i><span>Overview plan</span></a>
      </li>
      
      <li class="sub-menu">
        <a href="javascript:void(0);">
          <i class="fa fa-cogs"></i><span>Production Dashboard</span>
          <i class="arrow fa fa-angle-right pull-right"></i>
        </a>
        <ul>
          <li><a href="ui-modals-popups.html">Overview</a></li>
          <li><a href="ui-alerts-notifications.html">Press department</a></li>
          <li><a href="ui-panels.html">Heat department</a></li>
          <li><a href="ui-buttons.html">Lathe department</a></li>
          <li><a href="ui-slider-progress.html">Grinding department</a></li>
        </ul>
      </li>
      <li class="sub-menu">
        <a href="productionhistory.html">
          <i class="fa fa-text-height"></i><span>Production history</span>
        </a>
      </li>
      
      <li class="sub-menu">
        <a href="OEE.html">
          <i class="fa fa-text-height"></i><span>OEE</span>
        </a>
      </li>
      
      <li class="sub-menu">
        <a href="javascript:void(0);">
          <i class="fa fa-cogs"></i><span>Maintenance Dashboard</span>
          <i class="arrow fa fa-angle-right pull-right"></i>
        </a>
        <ul>
          <li><a href="ui-modals-popups.html">Overview</a></li>
          <li><a href="ui-alerts-notifications.html">Press department</a></li>
          <li><a href="ui-panels.html">Heat department</a></li>
          <li><a href="ui-buttons.html">Lathe department</a></li>
          <li><a href="ui-slider-progress.html">Grinding department</a></li>
        </ul>
      </li>
      <li class="sub-menu">
        <a href="admin.html">
          <i class="fa fa-text-height"></i><span>admin</span>
        </a>
      </li>
    </ul>
  </div>
</aside>

<!-- jQuery is required for the JS to work -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
  $("#leftside-navigation .sub-menu > a").click(function(e) {
    $("#leftside-navigation ul ul").slideUp();
    if (!$(this).next().is(":visible")) {
      $(this).next().slideDown();
    }
    e.stopPropagation();
  });
</script>

</body>
</html>