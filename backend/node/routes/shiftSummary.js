// backend/node/routes/shiftSummary.js
const express = require('express');
const router = express.Router();
const { getDbPool } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const { date, shift } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }

    let sql = `
      SELECT
        date,
        shift,
        department,
        machine,
        run_seconds,
        idle_seconds,
        alarm_seconds,
        offline_seconds,
        availability
      FROM machine_shift_status
      WHERE date = ?
    `;

    const params = [date];

    if (shift) {
      sql += ' AND shift = ?';
      params.push(shift);
    }

    sql += ' ORDER BY department, machine';

    const pool = await getDbPool();
    const [rows] = await pool.query(sql, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error('Shift summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;