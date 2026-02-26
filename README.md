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
    availability DECIMAL(6,4),

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


