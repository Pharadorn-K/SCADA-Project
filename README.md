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
│   │   ├── index.html 
│   │   ├── login.html 
│   │   └── favicon.ico 
│   └── src/                            # 🆕 Added — for dev (Vite/React/Vanilla) 
│       ├── main.js                     # App entry (WebSocket client) 
│       ├── dashboard.js                # ✅ Real-time panel logic (charts, controls) 
│       ├── api.js                      # HTTP API wrappers (/api/plc/start, etc.) │
│       └── styles/ 
│           ├── login.css 
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

relation each file
server.js
     ├──backend/node/.env
     ├──frontend/public/index.html
     ├──
     