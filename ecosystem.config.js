// ecosystem.config.js  — PM2 process manager config
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup          ← follow the printed command to enable auto-start on OS boot

'use strict';

const path = require('path');

// Resolve absolute paths so PM2 works regardless of cwd
const ROOT   = __dirname;
const NODE   = path.join(ROOT, 'backend', 'node');
const PYTHON = path.join(ROOT, 'backend', 'python');

module.exports = {
  apps: [
    // ── Node.js SCADA server ──────────────────────────────────────────────────
    {
      name:        'scada-node',
      script:      path.join(NODE, 'server.js'),
      cwd:         NODE,

      // Restart policy
      autorestart:    true,
      watch:          false,        // set true during dev if you want hot reload
      max_restarts:   20,
      min_uptime:     '10s',        // crash loop guard: must stay up ≥10s
      restart_delay:  3000,         // wait 3s between restarts

      // Environment
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },

      // PM2 log files (separate from scada.log)
      out_file:    path.join(ROOT, 'logs', 'pm2-node-out.log'),
      error_file:  path.join(ROOT, 'logs', 'pm2-node-err.log'),
      merge_logs:  false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Graceful shutdown: wait up to 8s for in-flight requests to finish
      kill_timeout:   8000,
      listen_timeout: 10000,
    },

    // ── Python PLC service ────────────────────────────────────────────────────
    {
      name:        'scada-python',
      script:      'plc_service.py',
      interpreter: 'python',        // change to 'python3' on Linux if needed
      cwd:         PYTHON,

      // Restart policy
      autorestart:    true,
      watch:          false,
      max_restarts:   20,
      min_uptime:     '10s',
      restart_delay:  5000,         // slightly longer — PLC reconnect needs time

      // PM2 log files
      out_file:    path.join(ROOT, 'logs', 'pm2-python-out.log'),
      error_file:  path.join(ROOT, 'logs', 'pm2-python-err.log'),
      merge_logs:  false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      kill_timeout: 5000,
    },
  ],
};