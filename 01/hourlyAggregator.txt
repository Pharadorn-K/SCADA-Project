// backend/node/services/hourlyAggregator.js
const stateStore = require('./stateStore');
const { getDbPool } = require('./db');

// ── Format a Date as MySQL DATETIME string in LOCAL time ─────────────────
// mysql2 sends JS Date as UTC which can give wrong date/hour
function toMySQLDatetime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toMySQLDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// Returns current hour truncated to HH:00:00 in local time
function currentHourBucket() {
  const now = new Date();
  now.setMinutes(0, 0, 0); // zero minutes, seconds, ms
  return now;
}

// ── Per-machine hour baseline ────────────────────────────────────────────
// key = "dept_machine__YYYY-MM-DD HH:00:00"  (local time string — stable)
const _hourBaselines = new Map();

function getHourSeconds(machine, bucketStr) {
  const key = `${machine.department}_${machine.machine}__${bucketStr}`;
  const d   = machine.shiftDurations;

  if (!_hourBaselines.has(key)) {
    _hourBaselines.set(key, {
      run:     d.run_seconds,
      idle:    d.idle_seconds,
      alarm:   d.alarm_seconds,
      offline: d.offline_seconds,
      setAt:   Date.now()
    });
  }

  const base = _hourBaselines.get(key);
  return {
    run:     Math.max(0, d.run_seconds     - base.run),
    idle:    Math.max(0, d.idle_seconds    - base.idle),
    alarm:   Math.max(0, d.alarm_seconds   - base.alarm),
    offline: Math.max(0, d.offline_seconds - base.offline),
  };
}

// ── Main write: called every 60 seconds ─────────────────────────────────
async function writeHourlySnapshot() {
  const pool      = await getDbPool();
  const machines  = stateStore.getPlcSnapshot().machines;
  const bucket    = currentHourBucket();
  const bucketStr = toMySQLDatetime(bucket);  // "2026-04-25 09:00:00"
  const dateStr   = toMySQLDate(bucket);      // "2026-04-25"

  for (const [key, machine] of Object.entries(machines)) {
    if (!machine.shiftDurations) continue;

    const h       = getHourSeconds(machine, bucketStr);
    // const planned = h.run + h.idle + h.alarm;
    // const avail   = planned > 0 ? h.run / planned : null;
    const planned = h.run + h.idle + h.alarm + h.offline;
    const avail   = planned > 0 ? h.run / planned : null;
    const shift   = machine.shift ?? 'A';

    await pool.query(
      `INSERT INTO machine_shift_status
         (date, shift, hour_bucket, department, machine,
          run_seconds, idle_seconds, alarm_seconds, offline_seconds, availability)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         run_seconds     = VALUES(run_seconds),
         idle_seconds    = VALUES(idle_seconds),
         alarm_seconds   = VALUES(alarm_seconds),
         offline_seconds = VALUES(offline_seconds),
         availability    = VALUES(availability),
         updated_at      = NOW()`,
      [
        dateStr,
        shift,
        bucketStr,   // ← stable string, not a Date object
        machine.department,
        machine.machine,
        h.run,
        h.idle,
        h.alarm,
        h.offline,
        avail
      ]
    );
  }
}

// Prune baselines older than 2 hours
function pruneBaselines() {
  const cutoff = Date.now() - 2 * 3600 * 1000;
  for (const [key, base] of _hourBaselines) {
    if (base.setAt < cutoff) _hourBaselines.delete(key);
  }
}

function startHourlyAggregator() {
  writeHourlySnapshot().catch(e => console.error('hourly snapshot error:', e));
  setInterval(() => {
    writeHourlySnapshot().catch(e => console.error('hourly snapshot error:', e));
  }, 60 * 1000);
  setInterval(pruneBaselines, 3600 * 1000);
  console.log('⏱ Hourly aggregator started');
}

module.exports = { startHourlyAggregator };