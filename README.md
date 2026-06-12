# SCADA Project

SCADA dashboard and PLC data service for machine status, shift production, alarms, OEE-style views, and admin operations.

The application has two backend processes:

- `scada-node`: Express/WebSocket server, frontend host, API routes, shift/state persistence, alarm history.
- `scada-python`: Python PLC service that connects to the PLC and exposes PLC data to the Node server over TCP.

The PM2 process file at `ecosystem.config.js` starts and monitors both services.

## Project Layout

```text
D:\GitHub\SCADA-Project
|-- .gitignore
|-- .vscode
|   `-- settings.json
|-- backend
|   |-- node
|   |   |-- .env
|   |   |-- data
|   |   |   `-- systemState.json
|   |   |-- generate-hash.js
|   |   |-- logs
|   |   |   `-- scada.log
|   |   |-- middleware
|   |   |   `-- requireRole.js
|   |   |-- node_modules
|   |   |   `-- (...)
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   |-- routes
|   |   |   |-- machineTimeline.js
|   |   |   |-- shiftHistory.js
|   |   |   |-- shiftSummary.js
|   |   |   `-- api
|   |   |       |-- alarm.js
|   |   |       |-- alarmHistory.js
|   |   |       |-- audit.js
|   |   |       |-- auth.js
|   |   |       |-- machineHistory.js
|   |   |       |-- machineOee.js
|   |   |       |-- machinePartHistory.js
|   |   |       |-- plantSummary.js
|   |   |       |-- plc.js
|   |   |       |-- ProductionOutput.js
|   |   |       `-- userManagement.js
|   |   |-- server.js
|   |   `-- services
|   |       |-- alarmService.js
|   |       |-- bootstrapEngine.js
|   |       |-- db.js
|   |       |-- hourlyAggregator.js
|   |       |-- logService.js
|   |       |-- persistenceEngine.js
|   |       |-- plcEngine.js
|   |       |-- plcMonitor.js
|   |       |-- pythonBridge.js
|   |       |-- sessionRegistry.js
|   |       |-- shiftEngine.js
|   |       `-- stateStore.js
|   `-- python
|       |-- __init__.py
|       |-- __pycache__
|       |   |-- config.cpython-313.pyc
|       |   |-- plc_loop.cpython-313.pyc
|       |   `-- plc_loop.cpython-314.pyc
|       |-- plc_loop.py
|       |-- plc_service.py
|       `-- utils
|           |-- __pycache__
|           |   |-- clean_data.cpython-313.pyc
|           |   |-- clean_data.cpython-314.pyc
|           |   |-- db_connector.cpython-313.pyc
|           |   |-- db_connector.cpython-314.pyc
|           |   |-- db_writer.cpython-313.pyc
|           |   `-- db_writer.cpython-314.pyc
|           |-- clean_data.py
|           |-- db_connector.py
|           `-- db_writer.py
|-- database
|   |-- Heat Interface device list.xlsx
|   |-- Lathe Interface device list.xlsx
|   |-- schema.sql
|   |-- seed.sql
|   |-- source_plc_location.csv
|   `-- test.py
|-- ecosystem.config.js
|-- env_01
|   |-- pyvenv.cfg
|   |-- Include
|   |-- Lib
|   |   `-- site-packages
|   `-- Scripts
|-- frontend
|   `-- public
|       |-- css
|       |   `-- fontawesome
|       |       `-- (...)
|       |   |-- header_press.png
|       |   |-- main.css
|       |   `-- webfonts
|       |       |-- fa-brands-400.woff2
|       |       |-- fa-regular-400.woff2
|       |       |-- fa-solid-900.woff2
|       |       `-- fa-v4compatibility.woff2
|       |-- favicon.ico
|       |-- images
|       |   |-- Availability.png
|       |   |-- Availability2.png
|       |   |-- heat_DKK1.png
|       |   |-- heat_DKK2.png
|       |   |-- heat_K3.png
|       |   |-- heat_K4.png
|       |   |-- heat_K5.png
|       |   |-- heat_K6.png
|       |   |-- heat_K7.png
|       |   |-- heat_K8.png
|       |   |-- lathe_Rotor TK1.png
|       |   |-- lathe_Rotor TK4.png
|       |   |-- OEE.png
|       |   |-- Performance.png
|       |   |-- press_AIDA630T.png
|       |   `-- press_M-20id-25.png
|       |-- index.html
|       |-- js
|       |   |-- api.js
|       |   |-- app.js
|       |   |-- routes.js
|       |   |-- shiftSummary.js
|       |   |-- sidebar-behavior.js
|       |   |-- sidebar.js
|       |   |-- store.js
|       |   |-- storeSelectors.js
|       |   |-- utils.js
|       |   `-- views
|       |       |-- admin.js
|       |       |-- home.js
|       |       |-- maintenance.js
|       |       `-- production.js
|       `-- login.html
|-- logs
|   `-- .gitkeep
|-- README.md
|-- scripts
|   |-- deploy.sh
|   `-- start-dev.sh
```

Skipped from this tree: `backend\node\node_modules`, `frontend\public\css\fontawesome`, and the expanded dependency files inside `env_01`.

## Prerequisites

- Node.js and npm
- Python virtual environment at `env_01`
- MySQL client/server access
- MySQL database named `scada`
- PLC reachable from this machine
- PM2 for process management

The Node server reads database and PLC settings from `backend/node/.env`.

## Local Development

Run the Python PLC service in one terminal:

```powershell
cd D:\GitHub\SCADA-Project
.\env_01\Scripts\Activate.ps1
cd backend\python
python plc_service.py
```

Run the Node server in another terminal:

```powershell
cd D:\GitHub\SCADA-Project\backend\node
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Database Setup

Base schema:

```powershell
cd D:\GitHub\SCADA-Project
& "C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysql.exe" -h 10.207.1.87 -P 3306 -u PCSET123 -p scada -e "SOURCE database/schema.sql"
```

Alarm history table used by `backend/node/services/logService.js`:

```sql
CREATE TABLE IF NOT EXISTS scada_alarm_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ts DATETIME(3) NOT NULL,
  event ENUM('RAISED','CLEARED','ACK') NOT NULL,
  code VARCHAR(128) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'INFO',
  ack_by VARCHAR(128) NULL,
  user_ VARCHAR(128) NOT NULL DEFAULT 'system',
  role_ VARCHAR(128) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alarm_ts (ts),
  INDEX idx_alarm_event (event),
  INDEX idx_alarm_code (code)
);
```

PowerShell does not support Bash-style input redirection with `<`. If you have a `.sql` migration file, use `SOURCE` instead:

```powershell
& "C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysql.exe" -h 10.207.1.87 -P 3306 -u PCSET123 -p scada -e "SOURCE database/migrate_alarm_log.sql"
```

Or from `cmd.exe`:

```cmd
mysql -u PCSET123 -p scada < database\migrate_alarm_log.sql
```

## PM2 Deployment

Install PM2 once per machine:

```powershell
npm install -g pm2
```

Create/confirm log folders:

```powershell
cd D:\GitHub\SCADA-Project
New-Item -ItemType Directory -Force logs
New-Item -ItemType Directory -Force backend\node\logs
```

Start both services in development mode:

```powershell
cd D:\GitHub\SCADA-Project
$env:Path = "D:\GitHub\SCADA-Project\env_01\Scripts;" + $env:Path
$env:PYTHONIOENCODING = "utf-8"
pm2 start ecosystem.config.js --env development
```

Production mode:

```powershell
pm2 start ecosystem.config.js
```

The `development` environment sets `NODE_ENV=development` for `scada-node`. The Python service does not define a separate PM2 development environment, so PM2 may print a warning for `scada-python`; this is expected.

## PM2 Operations

Check status:

```powershell
pm2 ls
```

Read logs:

```powershell
pm2 logs scada-node --lines 30
pm2 logs scada-python --lines 30
```

Restart services:

```powershell
pm2 restart scada-node
pm2 restart scada-python --update-env
```

Stop services:

```powershell
pm2 stop scada-node
pm2 stop scada-python
```

Save the current process list:

```powershell
pm2 save
```

## PM2 Startup on Windows

`pm2 startup` usually fails on Windows with `Init system not found`. Use the Windows startup helper instead:

```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

This creates a Windows startup registry entry and restores the saved PM2 process list after reboot.

## Logs

PM2 logs are written under the project root `logs` folder:

```text
logs\pm2-node-out-0.log
logs\pm2-node-err-0.log
logs\pm2-python-out-1.log
logs\pm2-python-err-1.log
```

Application alarm/event logs are written by the Node service under:

```text
backend\node\logs\scada.log
```

## Troubleshooting

PowerShell error: `The '<' operator is reserved for future use.`

- Use MySQL `SOURCE` with `-e`, or run the redirection command from `cmd.exe`.

PM2 error: `Interpreter python is NOT AVAILABLE in PATH.`

- Activate the virtualenv or prepend `env_01\Scripts` before starting/restarting PM2:

```powershell
$env:Path = "D:\GitHub\SCADA-Project\env_01\Scripts;" + $env:Path
pm2 restart scada-python --update-env
```

Python log error: `UnicodeEncodeError: 'charmap' codec can't encode character`

- Set UTF-8 output before starting/restarting the Python PM2 process:

```powershell
$env:PYTHONIOENCODING = "utf-8"
pm2 restart scada-python --update-env
pm2 save
```

Node log error: `Lost connection to Python PLC service`

- Check `scada-python` is online with `pm2 ls`.
- Check Python logs with `pm2 logs scada-python --lines 30`.
- Confirm `TCP_HOST` and `TCP_PORT` in `backend/node/.env` match `plc_service.py`.

## Current Known Runtime Settings

From `backend/node/.env`:

```text
Node server: http://localhost:3000
Python PLC TCP service: 127.0.0.1:8081
PLC IP: 10.207.1.24
MySQL host: 10.207.1.87
MySQL database: scada
```
## User command
### Start both
pm2 start scada-node
pm2 start scada-python

### Stop both
pm2 stop all

### Restart
pm2 restart scada-node
pm2 restart scada-node scada-python

### View live logs (most useful for debugging)
pm2 logs scada-python       # see why it's crashing
pm2 logs scada-node
pm2 logs                    # all processes together

### Clear restart counter
pm2 reset scada-python

### Monitor CPU/RAM live
pm2 monit

### Save current process list (so it survives reboot)
pm2 save

### Auto-start on Windows boot
pm2 startup
