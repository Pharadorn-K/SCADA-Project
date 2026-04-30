// backend/node/routes/shiftSummary.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../services/db');

const SHIFT_BUCKET = '1970-01-01 00:00:00';

router.get('/', async (req, res) => {
  try {
    const { date, shift } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    let sql = `
      SELECT department, machine,
             run_seconds, idle_seconds, alarm_seconds,
             offline_seconds, availability
      FROM machine_shift_status
      WHERE date = ?
        AND hour_bucket = ?
    `;
    const params = [date, SHIFT_BUCKET];

    if (shift) {
      sql += ' AND shift = ?';
      params.push(shift);
    }

    const pool = await getDbPool();
    const [rows] = await pool.query(sql, params);

    const departments = {};
    rows.forEach(r => {
      if (!departments[r.department]) {
        departments[r.department] = { run: 0, idle: 0, alarm: 0, offline: 0, machines: [] }; // here
      }
      departments[r.department].run   += r.run_seconds;
      departments[r.department].idle  += r.idle_seconds;
      departments[r.department].alarm += r.alarm_seconds;
      departments[r.department].offline += r.offline_seconds; // here
      departments[r.department].machines.push({
        ...r,
        availability: Number(r.availability)
      });
    });

    const departmentSummary = Object.entries(departments).map(([dept, d]) => {
      const planned = d.run + d.idle + d.alarm + d.offline; // here
      return {
        department:   dept,
        availability: planned > 0 ? d.run / planned : 0,
        machines:     d.machines
      };
    });

    let totalRun = 0, totalIdle = 0, totalAlarm = 0, totalOffline = 0;
    rows.forEach(r => {
      totalRun   += r.run_seconds;
      totalIdle  += r.idle_seconds;
      totalAlarm += r.alarm_seconds;
      totalOffline += r.offline_seconds; // here
    });

    const totalPlanned = totalRun + totalIdle + totalAlarm + totalOffline; // here
    res.json({
      success:           true,
      departments:       departmentSummary,
      totalAvailability: totalPlanned > 0 ? totalRun / totalPlanned : 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;