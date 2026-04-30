// backend/node/routes/shiftHistory.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../services/db');

const SHIFT_BUCKET = '1970-01-01 00:00:00';

function getShiftInfo() {
  const now  = new Date();
  const hour = now.getHours();
  let shift  = hour >= 6 && hour < 14 ? 'A' : hour >= 14 && hour < 22 ? 'B' : 'C';
  const shiftDate = new Date(now);
  if (shift === 'C' && hour < 6) shiftDate.setDate(shiftDate.getDate() - 1);
  return { shift, date: shiftDate.toISOString().split('T')[0] };
}

router.get('/', async (req, res) => {
  try {
    const pool = await getDbPool();

    // Only shift rows — use sentinel, not IS NULL
    const [rows] = await pool.query(
      `SELECT date, shift, department,
              run_seconds, idle_seconds, alarm_seconds, offline_seconds
       FROM machine_shift_status
       WHERE hour_bucket = ?
       ORDER BY date DESC, FIELD(shift, 'C', 'B', 'A')
       LIMIT 500`,
      [SHIFT_BUCKET]
    );

    const shifts = {};
    rows.forEach(r => {
      const key = `${r.date}_${r.shift}`;
      if (!shifts[key]) shifts[key] = { date: r.date, shift: r.shift, departments: {} };
      const d = shifts[key].departments;
      if (!d[r.department]) d[r.department] = { run: 0, idle: 0, alarm: 0, offline: 0 };
      d[r.department].run     += r.run_seconds;
      d[r.department].idle    += r.idle_seconds;
      d[r.department].alarm   += r.alarm_seconds;
      d[r.department].offline += r.offline_seconds;
    });

    const shiftArray = Object.values(shifts).map(s => ({
      date:  s.date,
      shift: s.shift,
      departments: Object.entries(s.departments).map(([dept, d]) => {
        const planned = d.run + d.idle + d.alarm + d.offline;
        return { department:   dept, availability: planned > 0 ? d.run / planned : 0};
      })
    }));

    const info = getShiftInfo();
    res.json({
      success:      true,
      currentShift: info.shift,
      shiftDate:    info.date,
      data:         shiftArray.slice(0, 18)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;