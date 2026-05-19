// backend/node/services/logService.js
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'scada.log');

const logs = []; // ✅ in-memory cache

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/* ---------- WRITE ---------- */

function writeLog(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('❌ Log write failed', err);
  });
}

/* ---------- PUBLIC API ---------- */

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
  const entry = {
    ts: new Date().toISOString(),
    type,
    severity,
    user,
    role,
    action,
    code,
    message,
    meta
  };

  logs.push(entry);
  writeLog(entry);
}

function getRecent({ type, limit = 100, from = null, to = null }) {
  let result = logs.filter(l => l.type === type);

  if (from) {
    const fromTs = new Date(from).getTime();
    result = result.filter(l => new Date(l.ts).getTime() >= fromTs);
  }

  if (to) {
    const toTs = new Date(to).getTime();
    result = result.filter(l => new Date(l.ts).getTime() <= toTs);
  }

  return result.slice(-limit);
}


/* ---------- WARM START ---------- */

function loadFromFile(limit = 10) {
  if (!fs.existsSync(LOG_FILE)) return;

  const lines = fs.readFileSync(LOG_FILE, 'utf8')
    .trim()
    .split('\n')
    .slice(-1000); // read a safe window

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'ALARM') {
        logs.push(entry);
      }
    } catch {
      /* ignore corrupted lines */
    }
  }

  // keep memory bounded
  while (logs.length > limit) logs.shift();

  console.log(`📜 Loaded ${logs.length} alarm(s) from history`);
}

module.exports = { log, getRecent, loadFromFile };
