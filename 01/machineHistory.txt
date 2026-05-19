// backend/node/routes/api/machineHistory.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../../services/db');

// Standard cycle times (seconds) — must match STANDARD_MAP in production.js
const STANDARD_MAP = {
  'Heat_DKK1':       86.9,
  'Heat_DKK2':       86.89,
  'Heat_K3':         94.98,
  'Heat_K4':         94.09,
  'Heat_K5':         90,
  'Heat_K6':         90,
  'Heat_K7':         96.18,
  'Heat_K8':         96.04,
  'Press_AIDA630T':  6.45,
  'Press_M-20id-25': 6.3,
  'Lathe_Rotor TK1': 93.45,
  'Lathe_Rotor TK4': 93.88,
};

function getStdCycleTime(dept, machine) {
  // dept comes in as 'heat'/'press'/'lathe' (lowercase from query param)
  const deptCap = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
  return STANDARD_MAP[`${deptCap}_${machine}`] ?? null;
}

function calcPerf(std, count_output, run_seconds) {
  if (!std || !run_seconds || !count_output) return null;
  return Math.min((std * count_output) / run_seconds * 100, 100);
}

function calcAvail(run, idle, alarm, offline) {
  const planned = run + idle + alarm + offline;
  return planned > 0 ? (run / planned) * 100 : null;
}

function calcOEE(avail, perf) {
  if (avail === null || perf === null) return null;
  return (avail / 100) * (perf / 100) * 100;
}

// GET /api/machine-history?dept=heat&machine=K7&mode=shifts|days|months
router.get('/', async (req, res) => {
  try {
    const { dept, machine, mode = 'shifts' } = req.query;

    if (!dept || !machine) {
      return res.status(400).json({ error: 'dept and machine required' });
    }

    // Normalise department for DB query (stored as 'Heat', 'Press', 'Lathe')
    const deptDB = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
    const std    = getStdCycleTime(dept, machine);
    const pool   = await getDbPool();

    let rows;

    if (mode === 'shifts') {
      // Last 31 shifts — one row per (date, shift), ordered newest first
      const [result] = await pool.query(
        `SELECT
           date,
           shift,
           SUM(run_seconds)     AS run,
           SUM(idle_seconds)    AS idle,
           SUM(alarm_seconds)   AS alarm,
           SUM(offline_seconds) AS offline,
           SUM(count_output)    AS count_output
         FROM machine_shift_summary
         WHERE department = ? AND machine = ?
         GROUP BY date, shift
         ORDER BY date DESC, FIELD(shift,'C','B','A')
         LIMIT 31`,
        [deptDB, machine]
      );
      rows = result;

    } else if (mode === 'days') {
      // Last 31 days — aggregate all shifts per day
      const [result] = await pool.query(
        `SELECT
           date,
           NULL AS shift,
           SUM(run_seconds)     AS run,
           SUM(idle_seconds)    AS idle,
           SUM(alarm_seconds)   AS alarm,
           SUM(offline_seconds) AS offline,
           SUM(count_output)    AS count_output
         FROM machine_shift_summary
         WHERE department = ? AND machine = ?
         GROUP BY date
         ORDER BY date DESC
         LIMIT 31`,
        [deptDB, machine]
      );
      rows = result;

    } else if (mode === 'months') {
      // Last 12 months — aggregate all shifts per month
      const [result] = await pool.query(
        `SELECT
           DATE_FORMAT(date, '%Y-%m') AS month_key,
           NULL AS shift,
           SUM(run_seconds)     AS run,
           SUM(idle_seconds)    AS idle,
           SUM(alarm_seconds)   AS alarm,
           SUM(offline_seconds) AS offline,
           SUM(count_output)    AS count_output
         FROM machine_shift_summary
         WHERE department = ? AND machine = ?
         GROUP BY DATE_FORMAT(date, '%Y-%m')
         ORDER BY month_key DESC
         LIMIT 12`,
        [deptDB, machine]
      );
      rows = result;

    } else {
      return res.status(400).json({ error: 'mode must be shifts|days|months' });
    }

    // Reverse so chart shows oldest → newest (left to right)
    rows = rows.reverse();

    // Build chart-ready data points
    const data = rows.map(r => {
      const run     = Number(r.run)          || 0;
      const idle    = Number(r.idle)         || 0;
      const alarm   = Number(r.alarm)        || 0;
      const offline = Number(r.offline)      || 0;
      const count   = Number(r.count_output) || 0;

      const avail = calcAvail(run, idle, alarm, offline);
      const perf  = calcPerf(std, count, run);
      const oee   = calcOEE(avail, perf);

      // Build label based on mode
      let label;
      if (mode === 'shifts') {
        // "A 11 May" style
        const d = new Date(r.date);
        const dayStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        label = `${r.shift} ${dayStr}`;
      } else if (mode === 'days') {
        const d = new Date(r.date);
        label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      } else {
        // months: "May 26"
        const [year, mon] = r.month_key.split('-');
        const d = new Date(Number(year), Number(mon) - 1, 1);
        label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      }

      return {
        label,
        avail:        avail !== null ? +avail.toFixed(1)  : null,
        perf:         perf  !== null ? +perf.toFixed(1)   : null,
        oee:          oee   !== null ? +oee.toFixed(1)    : null,
        run_seconds:  run,
        count_output: count
      };
    });

    res.json({
      success: true,
      dept,
      machine,
      mode,
      std_cycle_time: std,
      data
    });

  } catch (err) {
    console.error('machineHistory error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;