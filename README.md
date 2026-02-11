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
│       │   ├── api/                    
│       │   │   ├── alam.js
│       │   │   ├── alamHistory.js   
│       │   │   ├── audit.js   
│       │   │   ├── auth.js              
│       │   │   └── plc.js              
│       │   └── websocket.js           
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
│   │   ├── images/
│   │   │   ├── press_AIDA630T.png
│   │   │   ├── press_M-20id-25.png
│   │   │   ├── heat_DKK1.png
│   │   │   ├── heat_DKK2.png
│   │   │   ├── heat_K3.png
│   │   │   ├── heat_K4.png
│   │   │   ├── heat_K5.png
│   │   │   ├── heat_K6.png
│   │   │   ├── heat_K7.png
│   │   │   └── heat_K8.png
│   │   └── js/
│   │       ├── app.js
│   │       ├── api.js
│   │       ├── routes.js
│   │       ├── sidebar-behavior.js
│   │       ├── sidebar.js
│   │       ├── store.js
│   │       ├── storeSelectors.js
│   │       └── views/            
│   │           ├── home.js
│   │           ├── oee.js
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


# backend/python/plc_loop.py
...
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


# backend/python/utils/clean_data.py
...
def press_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [7,1,13,6,0]
    point_str = ["idle_","alarm_","offline_"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data in (all_data[point_int[4]]):
                if data["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data["type_"])
                    if data["note_"] == "Part_Name":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Plan" :
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "Alarm_Code":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "ID_Operator":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Status":
                        pick_up = bit_received[data["target_"]:data["target_"]+data["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)    
        # return machine_data
        if machine_data != []:
            for list_data in range(len(machine_data)):
                # status_check,count_check,status_count_check = [],[],[]
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_press_status[list_data]:
                    cycle_time = 0
                    count_today = 0
                    # queue_save_press.put((status_check,cycle_time,count_today))
                    compare_press_status[list_data] = status_check[point_int[1]:point_int[2]]
                    # print(status_check,cycle_time,count_today)
                    # clean_db_q.put((status_check,cycle_time,count_today))
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
                            "count_today": count_today
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
                            "cycle_time": cycle_time,
                            "count_today": count_today
                        }
                    })
                    # return status_check,cycle_time,count_today
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
                                cycle_time = (status_count_check[0] - old_row[0]["time_stamp"]).total_seconds()
                        count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1  
                        compare_press_count[list_data] = count_check
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
                                "count_today": count_today
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
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })
                        # return status_count_check,cycle_time,count_today
                    else : 
                        pass
                else :
                    compare_press_count[list_data] = count_check        
        else:
            print("❌ Press data is empty")
    except Exception as e:
        print("❌ Press clean data error:",e)
  
def heat_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [9,1,15,95,1]
    point_str = ["alarm_","setting_"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data in (all_data[point_int[4]]):
                if data["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data["type_"])
                    if data["note_"] == "Part_Name":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Plan" :
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "Alarm_Code":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "ID_Operator":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Status":
                        pick_up = bit_received[data["target_"]:data["target_"]+data["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)
        # return machine_data

        if machine_data != []:
            for list_data in range(len(machine_data)):
                # status_check,count_check,status_count_check = [],[],[]
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_heat_status[list_data]:
                    cycle_time = 0
                    count_today = 0
                    # queue_save_heat.put((status_check,cycle_time,count_today))   
                    compare_heat_status[list_data] = status_check[point_int[1]:point_int[2]]
                    # return status_check,cycle_time,count_today
                    # clean_db_q.put((status_check,cycle_time,count_today))
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
                            "count_today": count_today
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
                            "cycle_time": cycle_time,
                            "count_today": count_today
                        }
                    })

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
                                cycle_time = (status_count_check[0] - old_row[0]["time_stamp"]).total_seconds()
                        count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1  
                        compare_heat_count[list_data] = count_check
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
                                "count_today": count_today
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
                                "cycle_time": cycle_time,
                                "count_today": count_today
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
    global.services.stateStore.updatePlc(msg.payload);

    // Forward to plcMonitor (fan-out)
    updateData(msg.payload);
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

// backend/node/services/plcMonitor.js
const WebSocket = require('ws');

let wss = null;

// In-memory canonical PLC UI state
const plcState = {
  timestamp: Date.now(),
  machines: {}
};

function getSnapshot() {
  return plcState;
}

function updateData({ machineId, status, tags = {}, alarms = [] }) {
  if (!machineId) return;

  if (!plcState.machines[machineId]) {
    plcState.machines[machineId] = {
      status: 'STOPPED',
      tags: {},
      alarms: []
    };
  }

  const machine = plcState.machines[machineId];

  if (status) machine.status = status;
  Object.assign(machine.tags, tags);
  if (alarms.length) machine.alarms = alarms;

  plcState.timestamp = Date.now();

  broadcast({
    type: 'plc_clean',
    payload: {
      machineId,
      changes: { status, tags, alarms },
      timestamp: plcState.timestamp
    }
  });
}

function broadcast(message) {
  if (!wss) return;

  const data = JSON.stringify(message);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function setWss(server) {
  wss = server;

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'plc_snapshot',
      payload: getSnapshot()
    }));
  });
}

module.exports = {
  setWss,
  updateData,
  getSnapshot
};

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

function updatePlc(payload) {
  const { department, machine, timestamp, data } = payload;
  if (!department || !machine) return;

  if (!runtimeState.plc[department]) {
    runtimeState.plc[department] = {};
  }

  runtimeState.plc[department][machine] = {
    lastUpdate: new Date(timestamp).getTime(),
    data
  };
}

function getPlcSnapshot() {
  return runtimeState.plc;
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
  updatePlc,
  getPlcSnapshot,
  loadState,
  saveState
};


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

function initWebSocket() {
  if (scadaStore.ws) return;

  // const ws = new WebSocket('ws://localhost:3000');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}`);

  scadaStore.ws = ws;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'plc_snapshot') {
      scadaStore.setSnapshot(msg.payload);
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
  if (!btn || !layout) return;

  btn.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');

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

async function bootstrap() {
  const ok = await checkAuth();
  if (!ok) return;

  initWebSocket();
  mountTopbar();
  mountSidebar();        // injects sidebar HTML
  initSidebarToggle();   // now button exists
  navigate('home');
}


bootstrap();



// frontend/public/js/store.js
function deriveStatus(metrics) {
  if (metrics.alarm) return 'ALARM';
  if (metrics.run) return 'RUNNING';
  if (metrics.idle) return 'IDLE';
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

    this.state.machines[key] = {
      department: payload.department,
      machineType: payload.machine_type,
      status: deriveStatus(payload.metrics),
      tags: {
        cycle_time: payload.metrics.cycle_time,
        count_today: payload.metrics.count_today,
        plan: payload.context.plan
      },
      alarms: payload.metrics.alarm ? [payload.metrics.alarm_code] : [],
      lastUpdate: Date.now()
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

// frontend/public/js/routes.js
import * as Home from './views/home.js';
import * as Production from './views/production.js';
import * as Maintenance from './views/maintenance.js';
import * as Admin from './views/admin.js';
import * as OEE from './views/oee.js';

export const routes = {
  home: {
    mount: Home.homeMount,
    unmount: Home.homeUnmount
  },

  production: {
    history: {
      view: Production.productionHistoryView,
      mount: Production.productionHistoryMount,
      unmount: Production.productionHistoryUnmount
    },
    press: {
      view: Production.productionPressView
    },
    heat: {
      view: Production.productionHeatView
    },
    lathe: {
      view: Production.productionLatheView
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

  oee: {
    view: OEE.oeeView
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

// frontend/public/js/views/home.js
import { scadaStore } from '../store.js';
// import { selectByPlant } from '../storeSelectors.js';
import { selectPressMachines } from '../storeSelectors.js';

let unsubscribe = null;

export function homeMount(container) {
  const plantId = 'plant1'; // home focuses on Plant 1

  container.innerHTML = `
    <h1>🏭 SCADA Dashboard – Home</h1>

    <section class="plant-header">
      <h2>Plant 1 Overview</h2>
      <span id="plant-timestamp"></span>

    </section>

    <section id="machine-grid" class="machine-grid"></section>
  `;

  const grid = container.querySelector('#machine-grid');
  const tsEl = container.querySelector('#plant-timestamp');

  function statusClass(machine) {
    if (machine.alarms?.length) return 'alarm';
    return machine.status?.toLowerCase() || 'idle';
  }

  unsubscribe = scadaStore.subscribe(state => {
    // const machines = selectByPlant(state, plantId);
    const machines = selectPressMachines(state);


    grid.innerHTML = '';
    machines.forEach(([id, m]) => {
      const card = document.createElement('div');
      card.className = `machine-card ${statusClass(m)}`;

      card.innerHTML = `
        <div class="machine-title">${id}</div>
        <div class="machine-status">Status: ${m.status}</div>

        <div>Status: ${m.status}</div>

        <div class="machine-tags">
          <div>Cycle: ${m.tags?.cycle_time ?? '--'} s</div>
          <div>Count: ${m.tags?.part_count ?? '--'}</div>
        </div>

        ${m.alarms?.length
          ? `<div class="alarm-badge">${m.alarms.length} ALARM</div>`
          : ''
        }
      `;

      grid.appendChild(card);
    });

    tsEl.textContent = state.timestamp
      ? new Date(state.timestamp).toLocaleTimeString()
      : '';
  });
}

export function homeUnmount() {
  if (unsubscribe) unsubscribe();
}
