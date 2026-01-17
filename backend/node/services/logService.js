// backend/node/services/logService.js
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'scada.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('❌ Log write failed', err);
  });
}

function log({
  type,
  severity = 'INFO',
  user = 'system',
  role = 'system',
  action = null,
  code = null,
  message = '',
  meta = {}
}) {
  writeLog({
    ts: new Date().toISOString(),
    type,
    severity,
    user,
    role,
    action,
    code,
    message,
    meta
  });
}

module.exports = { log };
