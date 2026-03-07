// backend/node/routes/shiftSummary.js
const express = require('express');
const router = express.Router();
const { getDbPool } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const { date, shift } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    let sql = `
      SELECT
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
    const pool = await getDbPool();
    const [rows] = await pool.query(sql, params);

    // 🔥 Build department summary
    const departments = {};

    rows.forEach(r => {

      if (!departments[r.department]) {
        departments[r.department] = {
          run: 0,
          idle: 0,
          alarm: 0,
          machines: []
        };
      }

      departments[r.department].run += r.run_seconds;
      departments[r.department].idle += r.idle_seconds;
      departments[r.department].alarm += r.alarm_seconds;

      departments[r.department].machines.push({
        ...r,
        availability: Number(r.availability)
      });
    });

    // 🔥 Compute department availability
    const departmentSummary = Object.entries(departments).map(([dept, d]) => {

      const planned = d.run + d.idle + d.alarm;
      const availability = planned > 0 ? d.run / planned : 0;

      return {
        department: dept,
        availability,
        machines: d.machines
      };
    });

    // 🔥 Compute total factory availability
    let totalRun = 0;
    let totalIdle = 0;
    let totalAlarm = 0;

    rows.forEach(r => {
      totalRun += r.run_seconds;
      totalIdle += r.idle_seconds;
      totalAlarm += r.alarm_seconds;
    });

    const totalPlanned = totalRun + totalIdle + totalAlarm;
    const totalAvailability =
      totalPlanned > 0 ? totalRun / totalPlanned : 0;

    res.json({
      success: true,
      departments: departmentSummary,
      totalAvailability
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;