// backend/node/routes/api/machineOee.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../../services/db');

const TABLE_MAP = {
  press: 'raw_press',
  heat:  'raw_heat',
  lathe: 'raw_lathe'
};

// Format Date → MySQL datetime string in LOCAL time
function toMySQL(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getWindowRange(windowHours) {
  const to   = new Date();
  const from = new Date(Date.now() - windowHours * 3600 * 1000);
  return { from, to };
}

// GET /api/machine-oee?dept=heat&machine=K7&window=8|24
router.get('/', async (req, res) => {
  try {
    const { dept, machine, window: win } = req.query;

    if (!dept || !machine || !win) {
      return res.status(400).json({ error: 'dept, machine, window required' });
    }

    const hours   = win === '24' ? 24 : 8;
    const deptKey = dept.toLowerCase();
    const table   = TABLE_MAP[deptKey];

    if (!table) {
      return res.status(400).json({ error: `unknown dept: ${dept}` });
    }

    const { from, to } = getWindowRange(hours);
    const fromStr = toMySQL(from);
    const toStr   = toMySQL(to);

    // Department stored with capital first letter in DB ('Heat', 'Press', 'Lathe')
    const deptDB = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();

    const pool = await getDbPool();

    // ── Count output (count_signal = 1) in the window ────────────────────
    // Uses raw_* table with (machine, timestamp) index — fast.
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count_output
       FROM ${table}
       WHERE machine = ? AND timestamp >= ? AND timestamp < ? AND count_signal = 1`,
      [machine, fromStr, toStr]
    );
    const countOutput = Number(countRows[0].count_output) || 0;

    // ── Run/idle/alarm/offline seconds from hourly rows ───────────────────
    // machine_shift_status contains ONLY real hourly rows after the table
    // split (sentinel rows moved to machine_shift_summary). No extra filter
    // for hour_bucket needed — every row here is a real hourly snapshot.
    const [hourRows] = await pool.query(
      `SELECT
         SUM(run_seconds)     AS run,
         SUM(idle_seconds)    AS idle,
         SUM(alarm_seconds)   AS alarm,
         SUM(offline_seconds) AS offline
       FROM machine_shift_status
       WHERE department = ? AND machine = ? AND hour_bucket >= ?`,
      [deptDB, machine, fromStr]
    );

    const hr = hourRows[0];
    let run     = Number(hr.run)     || 0;
    let idle    = Number(hr.idle)    || 0;
    let alarm   = Number(hr.alarm)   || 0;
    let offline = Number(hr.offline) || 0;

    // ── Add live seconds for current incomplete minute ────────────────────
    // Hourly rows lag up to 60s; stateStore has the live remainder.
    const machines = global.services.stateStore.getPlcSnapshot().machines;
    const key = `${deptKey}_${machine}`;
    const m   = machines[key];

    if (m?.statusStartedAt) {
      const live = Math.floor((Date.now() - m.statusStartedAt) / 1000);
      if (m.status === 'RUNNING') run     += live;
      if (m.status === 'IDLE')    idle    += live;
      if (m.status === 'ALARM')   alarm   += live;
      if (m.status === 'OFFLINE') offline += live;
    }

    res.json({
      window:          `${hours}h`,
      dept,
      machine,
      from:            fromStr,
      to:              toStr,
      count_output:    countOutput,
      run_seconds:     run,
      idle_seconds:    idle,
      alarm_seconds:   alarm,
      offline_seconds: offline
    });

  } catch (err) {
    console.error('machineOee error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;