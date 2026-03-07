// backend/node/routes/shiftHistory.js
const express = require('express');
const router = express.Router();
const { getDbPool } = require('../services/db');

function getShiftInfo() {

  const now = new Date();
  const hour = now.getHours();

  let shift;

  if (hour >= 6 && hour < 14) shift = 'A';
  else if (hour >= 14 && hour < 22) shift = 'B';
  else shift = 'C';

  const shiftDate = new Date(now);

  // 🔥 If time is 00:00-05:59 → still yesterday's Shift C
  if (shift === 'C' && hour < 6) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  const dateStr = shiftDate.toISOString().split('T')[0];

  return {
    shift,
    date: dateStr
  };
}

router.get('/', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date required' });
    }
    const sql = `
    SELECT
      date,
      shift,
      department,
      run_seconds,
      idle_seconds,
      alarm_seconds
    FROM machine_shift_status
    ORDER BY
      date DESC,
      FIELD(shift,'C','B','A')
    LIMIT 500
    `;
    const pool = await getDbPool();
    const [rows] = await pool.query(sql, [date, date]);

    // 🔥 group by shift + department
    const shifts = {};

    rows.forEach(r => {

      const key = `${r.date}_${r.shift}`;

      if (!shifts[key]) {
        shifts[key] = {
          date: r.date,
          shift: r.shift,
          departments: {}
        };
      }

      if (!shifts[key].departments[r.department]) {
        shifts[key].departments[r.department] = {
          run: 0,
          idle: 0,
          alarm: 0
        };
      }

      shifts[key].departments[r.department].run += r.run_seconds;
      shifts[key].departments[r.department].idle += r.idle_seconds;
      shifts[key].departments[r.department].alarm += r.alarm_seconds;

    });
    // 🔥 calculate availability per shift + department
    const shiftArray = Object.values(shifts).map(s => {

      const departments = Object.entries(s.departments).map(([dept, d]) => {

        const planned = d.run + d.idle + d.alarm;
        const availability = planned > 0 ? d.run / planned : 0;

        return {
          department: dept,
          availability
        };

      });

      return {
        date: s.date,
        shift: s.shift,
        departments
      };

    });

    const lastShifts = shiftArray.slice(0, 10);
    const shiftInfo = getShiftInfo();
    res.json({
      success: true,
      currentShift: shiftInfo.shift,
      shiftDate: shiftInfo.date,
      data: lastShifts
    });    

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;