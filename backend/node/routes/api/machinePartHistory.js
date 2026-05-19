// backend/node/routes/api/machinePartHistory.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../../services/db');

const TABLE_MAP = {
  press: 'raw_press',
  heat:  'raw_heat',
  lathe: 'raw_lathe'
};

// GET /api/machine-part-history?dept=heat&machine=K7
// Returns available months + optionally filters by month=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const { dept, machine, month } = req.query;

    if (!dept || !machine) {
      return res.status(400).json({ error: 'dept and machine required' });
    }

    const deptKey = dept.toLowerCase();
    const table   = TABLE_MAP[deptKey];
    if (!table) return res.status(400).json({ error: `unknown dept: ${dept}` });

    const pool = await getDbPool();

    // ── 1. Get available months that have data for this machine ──────────
    const [monthRows] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(timestamp, '%Y-%m') AS month_key
       FROM ${table}
       WHERE machine = ? AND count_signal = 1
       ORDER BY month_key DESC
       LIMIT 24`,
      [machine]
    );

    const availableMonths = monthRows.map(r => r.month_key);

    // If no month requested, use the most recent one
    const selectedMonth = month && availableMonths.includes(month)
      ? month
      : availableMonths[0] ?? null;

    if (!selectedMonth) {
      return res.json({
        success: true,
        machine,
        dept,
        available_months: [],
        selected_month:   null,
        parts:            []
      });
    }

    // ── 2. Get distinct part names + total count for selected month ──────
    const [year, mon] = selectedMonth.split('-');
    const [partRows] = await pool.query(
      `SELECT
         part_name,
         COUNT(*) AS total_production
       FROM ${table}
       WHERE machine = ?
         AND count_signal = 1
         AND YEAR(timestamp)  = ?
         AND MONTH(timestamp) = ?
       GROUP BY part_name
       ORDER BY total_production DESC`,
      [machine, year, mon]
    );

    res.json({
      success:          true,
      machine,
      dept,
      available_months: availableMonths,
      selected_month:   selectedMonth,
      parts:            partRows.map(r => ({
        part_name:        r.part_name || '(no part)',
        total_production: Number(r.total_production)
      }))
    });

  } catch (err) {
    console.error('machinePartHistory error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;