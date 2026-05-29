// backend/node/routes/api/productionOutput.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../../services/db');

const STANDARD_MAP = {
  'Heat_DKK1': 86.9, 'Heat_DKK2': 86.89, 'Heat_K3': 94.98, 'Heat_K4': 94.09,
  'Heat_K5': 90,     'Heat_K6': 90,       'Heat_K7': 96.18,  'Heat_K8': 96.04,
  'Press_AIDA630T': 6.45, 'Press_M-20id-25': 6.3,
  'Lathe_Rotor TK1': 93.45, 'Lathe_Rotor TK4': 93.88,
};

function getStd(dept, machine) {
  const d = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
  return STANDARD_MAP[`${d}_${machine}`] ?? null;
}

function calcAvail(run, idle, alarm, offline) {
  const planned = run + idle + alarm + offline;
  return planned > 0 ? +(run / planned * 100).toFixed(1) : null;
}

function calcPerf(std, count, run) {
  if (!std || !run || !count) return null;
  return +(std * count / run * 100).toFixed(1);
}

function calcOEE(avail, perf) {
  if (avail === null || perf === null) return null;
  return +Math.min(avail / 100 * perf / 100 * 100, 100).toFixed(1);
}

// ── GET /api/production-output/filters?month=YYYY-MM
// Returns available departments, machines, part names for the given month
router.get('/filters', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month required' });

    const [year, mon] = month.split('-');
    const pool = await getDbPool();

    const tables = ['raw_press', 'raw_heat', 'raw_lathe'];
    const depts  = [], machines = [], parts = [];

    for (const table of tables) {
      const [rows] = await pool.query(
        `SELECT DISTINCT department, machine, part_name
         FROM ${table}
         WHERE YEAR(timestamp) = ? AND MONTH(timestamp) = ? AND count_signal = 1`,
        [year, mon]
      );
      rows.forEach(r => {
        if (r.department && !depts.includes(r.department)) depts.push(r.department);
        if (r.machine    && !machines.includes(r.machine)) machines.push(r.machine);
        if (r.part_name  && !parts.includes(r.part_name)) parts.push(r.part_name);
      });
    }

    res.json({ success: true, departments: depts.sort(), machines: machines.sort(), parts: parts.sort() });
  } catch (err) {
    console.error('productionOutput filters error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── GET /api/production-output?month=YYYY-MM&dept=Press&machine=AIDA630T&part=xxx
// Returns daily rows grouped by (date, department, machine, part_name)
router.get('/', async (req, res) => {
  try {
    const { month, dept, machine, part } = req.query;
    if (!month) return res.status(400).json({ error: 'month required' });

    const [year, mon] = month.split('-');
    const pool = await getDbPool();

    const TABLE_MAP = {
      press: 'raw_press', heat: 'raw_heat', lathe: 'raw_lathe'
    };

    // Determine which tables to query
    let tablesToQuery;
    if (dept) {
      const key = dept.toLowerCase();
      if (!TABLE_MAP[key]) return res.status(400).json({ error: 'unknown dept' });
      tablesToQuery = [{ table: TABLE_MAP[key], deptDB: dept }];
    } else {
      tablesToQuery = [
        { table: 'raw_press', deptDB: 'Press' },
        { table: 'raw_heat',  deptDB: 'Heat'  },
        { table: 'raw_lathe', deptDB: 'Lathe' },
      ];
    }

    const allRows = [];

    for (const { table, deptDB } of tablesToQuery) {
      let sql = `
        SELECT
          DATE(timestamp)    AS date,
          department,
          machine,
          part_name,
          COUNT(*)           AS count_output,
          AVG(cycle_time)    AS avg_cycle_time
        FROM ${table}
        WHERE YEAR(timestamp) = ? AND MONTH(timestamp) = ? AND count_signal = 1
      `;
      const params = [year, mon];

      if (dept)    { sql += ' AND department = ?'; params.push(deptDB); }
      if (machine) { sql += ' AND machine = ?';    params.push(machine); }
      if (part)    { sql += ' AND part_name = ?';  params.push(part); }

      sql += ' GROUP BY DATE(timestamp), department, machine, part_name ORDER BY DATE(timestamp) ASC, machine ASC, part_name ASC';

      const [rows] = await pool.query(sql, params);
      allRows.push(...rows);
    }

    // Join shift summary for availability / performance / OEE per (date, machine)
    // We aggregate machine_shift_summary per calendar day
    const machineKeys = [...new Set(allRows.map(r => `${r.department}__${r.machine}`))];
    const shiftMap = {};

    for (const key of machineKeys) {
      const [d, m] = key.split('__');
      const deptDB = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
      const [srows] = await pool.query(
        `SELECT
           date,
           SUM(run_seconds)     AS run,
           SUM(idle_seconds)    AS idle,
           SUM(alarm_seconds)   AS alarm,
           SUM(offline_seconds) AS offline
         FROM machine_shift_summary
         WHERE department = ? AND machine = ?
           AND YEAR(date) = ? AND MONTH(date) = ?
         GROUP BY date`,
        [deptDB, m, year, mon]
      );
      srows.forEach(sr => {
        const dateStr = sr.date instanceof Date
          ? sr.date.toISOString().split('T')[0]
          : String(sr.date).split('T')[0];
        shiftMap[`${deptDB}__${m}__${dateStr}`] = sr;
      });
    }

    // Build output rows
    const result = allRows.map(r => {
      const dateStr = r.date instanceof Date
        ? r.date.toISOString().split('T')[0]
        : String(r.date).split('T')[0];
      const deptCap = r.department.charAt(0).toUpperCase() + r.department.slice(1).toLowerCase();
      const sm = shiftMap[`${deptCap}__${r.machine}__${dateStr}`];

      const run     = Number(sm?.run)     || 0;
      const idle    = Number(sm?.idle)    || 0;
      const alarm   = Number(sm?.alarm)   || 0;
      const offline = Number(sm?.offline) || 0;
      const std     = getStd(r.department, r.machine);
      const count   = Number(r.count_output) || 0;
      const avgCycle = r.avg_cycle_time ? +Number(r.avg_cycle_time).toFixed(1) : null;

      const avail = calcAvail(run, idle, alarm, offline);
      const perf  = calcPerf(std, count, run);
      const oee   = calcOEE(avail, perf);

      return {
        date:           dateStr,
        department:     r.department,
        machine:        r.machine,
        part_name:      r.part_name || '',
        count_output:   count,
        avg_cycle_time: avgCycle,
        std_cycle_time: std,
        avail,
        perf,
        oee,
        run_seconds:    run,
        idle_seconds:   idle,
        alarm_seconds:  alarm,
        offline_seconds:offline,
      };
    });

    res.json({ success: true, month, rows: result });
  } catch (err) {
    console.error('productionOutput error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;