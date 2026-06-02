// backend/node/services/logService.js
'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_DIR      = path.join(__dirname, '../logs');
const LOG_FILE     = path.join(LOG_DIR,   'scada.log');
const MAX_BYTES    = 20 * 1024 * 1024;   // 20 MB hard cap before rotation
const KEEP_BACKUPS = 5;                  // scada.log.1 … scada.log.5
const MEM_LIMIT    = 500;                // max alarm entries kept in RAM

// In-memory cache — alarm events only (used by alarmHistory route)
const _alarmCache = [];

// ── Ensure log directory exists ───────────────────────────────────────────────
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ── Log rotation ──────────────────────────────────────────────────────────────
// Called synchronously before each write so we never block the event loop on
// a hot path — stat() on a local file is fast enough for a once-per-write check.
function _rotatIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_BYTES) return;

    // Shift existing backups:  .5 deleted, .4→.5, .3→.4 … .1→.2, current→.1
    for (let i = KEEP_BACKUPS; i >= 1; i--) {
      const older = `${LOG_FILE}.${i}`;
      const newer = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      if (fs.existsSync(newer)) {
        fs.renameSync(newer, older);
      }
    }
  } catch (_) {
    // stat failed (file doesn't exist yet) — nothing to rotate
  }
}

// ── File write ────────────────────────────────────────────────────────────────
function _writeToFile(entry) {
  _rotatIfNeeded();
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line, err => {
    if (err) console.error('❌ Log write failed:', err.message);
  });
}

// ── DB write (alarm events only, async, non-blocking) ─────────────────────────
async function _writeAlarmToDB(entry) {
  try {
    const { getDbPool } = require('./db');
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO scada_alarm_log
         (ts, event, code, message, severity, ack_by, user_, role_)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date(entry.ts),
        entry.action === 'ACK_ALARM'   ? 'ACK'
          : entry.action === 'CLEARED' ? 'CLEARED'
          : 'RAISED',
        entry.code    ?? '',
        entry.message ?? '',
        entry.severity,
        entry.ackBy   ?? null,
        entry.user    ?? 'system',
        entry.role    ?? 'system',
      ]
    );
  } catch (err) {
    // DB might not be up yet on boot — silent fail, file is the fallback
    if (process.env.NODE_ENV !== 'test') {
      console.warn('⚠️  alarm DB write skipped:', err.message);
    }
  }
}

// ── Public: log() ─────────────────────────────────────────────────────────────
function log({
  type,
  severity = 'INFO',
  user     = 'system',
  role     = 'system',
  action   = null,
  code     = null,
  message  = '',
  meta     = {},
  ackBy    = null,
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
    meta,
    ackBy,
  };

  // Always write to file
  _writeToFile(entry);

  // Keep alarm events in memory + DB
  if (type === 'ALARM') {
    _alarmCache.push(entry);
    if (_alarmCache.length > MEM_LIMIT) _alarmCache.shift();
    _writeAlarmToDB(entry);  // fire-and-forget
  }
}

// ── Public: getRecent() ───────────────────────────────────────────────────────
// Serves the alarm history route — reads from in-memory cache (populated from
// DB on boot, so survives restarts correctly).
function getRecent({ type, limit = 100, from = null, to = null }) {
  // Only ALARM type is cached in memory; other types would need file scanning
  if (type !== 'ALARM') return [];

  let result = [..._alarmCache];

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

// ── Public: loadFromDB() ──────────────────────────────────────────────────────
// Called once on server startup (replaces the old loadFromFile).
// Loads the last MEM_LIMIT alarm events from the DB so the cache is warm
// even after a crash + restart.
async function loadFromDB(limit = MEM_LIMIT) {
  try {
    const { getDbPool } = require('./db');
    const pool = await getDbPool();
    const [rows] = await pool.query(
      `SELECT ts, event, code, message, severity, ack_by, user_, role_
       FROM scada_alarm_log
       ORDER BY id DESC
       LIMIT ?`,
      [limit]
    );

    // rows come back newest-first; reverse so cache is chronological
    for (const r of rows.reverse()) {
      _alarmCache.push({
        ts:       r.ts instanceof Date ? r.ts.toISOString() : r.ts,
        type:     'ALARM',
        severity: r.severity,
        user:     r.user_,
        role:     r.role_,
        action:   r.event === 'ACK' ? 'ACK_ALARM' : r.event === 'CLEARED' ? 'CLEARED' : 'RAISED',
        code:     r.code,
        message:  r.message,
        ackBy:    r.ack_by ?? null,
        meta:     {},
      });
    }

    // Honour memory cap
    while (_alarmCache.length > MEM_LIMIT) _alarmCache.shift();

    console.log(`📜 Loaded ${_alarmCache.length} alarm event(s) from DB`);
  } catch (err) {
    // DB not ready yet (first boot) — fall back to file
    console.warn('⚠️  loadFromDB failed, falling back to file:', err.message);
    _loadFromFileFallback(limit);
  }
}

// ── Internal: file fallback for very first boot (no DB table yet) ─────────────
function _loadFromFileFallback(limit = MEM_LIMIT) {
  if (!fs.existsSync(LOG_FILE)) return;

  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8')
      .trim()
      .split('\n')
      .slice(-Math.max(limit * 10, 2000)); // scan broader window

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'ALARM') _alarmCache.push(entry);
      } catch { /* skip corrupt line */ }
    }

    while (_alarmCache.length > limit) _alarmCache.shift();
    console.log(`📜 (file fallback) Loaded ${_alarmCache.length} alarm event(s)`);
  } catch (err) {
    console.warn('⚠️  log file fallback failed:', err.message);
  }
}

// ── Keep loadFromFile exported for backward-compat (now a no-op wrapper) ──────
function loadFromFile(_limit) {
  // Intentionally empty — call loadFromDB() instead (done in server.js).
  // Kept so existing code that imports this name doesn't throw.
}

module.exports = { log, getRecent, loadFromDB, loadFromFile };