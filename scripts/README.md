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

# Project structure           
D:\GitHub\SCADA-Project
├───README.md
│   
├───.git
│   └───(...)
│   
├───.vscode
│   └───settings.json
│       
├───backend
│   ├───node
│   │   ├───.env ✅
│   │   ├───generate-hash.js
│   │   ├───package.json
│   │   ├───package-lock.json
│   │   ├───server.js ✅
│   │   │   
│   │   ├───data
│   │   │   └───systemState.json
│   │   │       
│   │   ├───logs
│   │   │   └───scada.log
│   │   │       
│   │   ├───middleware
│   │   │   └───requireRole.js ✅
│   │   │       
│   │   ├───node_modules
│   │   │   └───(...)
│   │   │   
│   │   ├───routes
│   │   │   ├───machineTimeline.js ✅
│   │   │   ├───shiftHistory.js ✅
│   │   │   ├───shiftSummary.js ✅
│   │   │   │   
│   │   │   └───api
│   │   │       ├───alarm.js ✅
│   │   │       ├───alarmHistory.js ✅
│   │   │       ├───audit.js ✅
│   │   │       ├───auth.js ✅
│   │   │       ├───machineHistory.js ✅
│   │   │       ├───machineOee.js ✅
│   │   │       ├───machinePartHistory.js ✅
│   │   │       ├───plantSummary.js ✅
│   │   │       └───plc.js ✅
│   │   │      
│   │   └───services
│   │       ├───alarmService.js ✅
│   │       ├───bootstrapEngine.js ✅
│   │       ├───db.js ✅
│   │       ├───hourlyAggregator.js ✅
│   │       ├───logService.js ✅
│   │       ├───persistenceEngine.js ✅
│   │       ├───plcEngine.js ✅
│   │       ├───plcMonitor.js ✅
│   │       ├───pythonBridge.js ✅
│   │       ├───sessionRegistry.js ✅
│   │       ├───shiftEngine.js ✅
│   │       └───stateStore.js ✅
│   │          
│   └───python
│       ├───__init__.py
│       ├───plc_loop.py ✅
│       ├───plc_service.py ✅
│       │   
│       ├───utils
│       │   ├───clean_data.py ✅
│       │   ├───db_connector.py ✅
│       │   ├───db_writer.py ✅
│       │   │   
│       │   └───__pycache__
│       │       └───(...)
│       │           
│       └───__pycache__
│           └───(...)
│              
├───database
│   └───(...)
│      
├───env_01
│   └───(...)
│   
├───frontend
│   ├───public
│   │   ├───favicon.ico ✅
│   │   ├───index.html ✅
│   │   ├───login.html ✅
│   │   │   
│   │   ├───css
│   │   │   ├───header_press.png
│   │   │   ├───main.css ✅
│   │   │   │   
│   │   │   ├───fontawesome
│   │   │   │   └───(...)
│   │   │   │       
│   │   │   └───webfonts
│   │   │       └───(...)
│   │   │           
│   │   ├───images
│   │   │   ├───Availability.png
│   │   │   ├───Availability2.png
│   │   │   ├───heat_DKK1.png
│   │   │   ├───heat_DKK2.png
│   │   │   ├───heat_K3.png
│   │   │   ├───heat_K4.png
│   │   │   ├───heat_K5.png
│   │   │   ├───heat_K6.png
│   │   │   ├───heat_K7.png
│   │   │   ├───heat_K8.png
│   │   │   ├───lathe_Rotor TK1.png
│   │   │   ├───lathe_Rotor TK4.png
│   │   │   ├───OEE.png
│   │   │   ├───Performance.png
│   │   │   ├───press_AIDA630T.png
│   │   │   └───press_M-20id-25.png
│   │   │       
│   │   └───js
│   │       ├───api.js ✅
│   │       ├───app.js ✅
│   │       ├───routes.js ✅
│   │       ├───shiftSummary.js ✅
│   │       ├───sidebar-behavior.js ✅
│   │       ├───sidebar.js ✅
│   │       ├───store.js ✅
│   │       ├───storeSelectors.js ✅
│   │       ├───utils.js ✅
│   │       │   
│   │       └───views
│   │           ├───admin.js ✅
│   │           ├───home.js ✅
│   │           ├───maintenance.js ✅
│   │           └───production.js ✅
│   │               
│   └───src
│       └───(...)
│               
└───scripts
    └───(...)