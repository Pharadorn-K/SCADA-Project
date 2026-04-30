// backend/node/routes/api/plantSummary.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../../services/db');

// GET /api/plant-summary?window=shift|8|24
router.get('/', async (req, res) => {
  try {
    const { window = 'shift' } = req.query;

    // Current shift → serve from live stateStore, no DB needed
    if (window === 'shift') {
        const machines  = global.services.stateStore.getPlcSnapshot().machines;
        let run = 0, idle = 0, alarm = 0, offline = 0;

        for (const m of Object.values(machines)) {
            const d = m.shiftDurations;
            if (!d) continue;
            run     += d.run_seconds;
            idle    += d.idle_seconds;
            alarm   += d.alarm_seconds;
            offline += d.offline_seconds;

        // Add live seconds for current status (not yet ticked into shiftDurations)
            if (m.statusStartedAt) {
            const live = Math.floor((Date.now() - m.statusStartedAt) / 1000);
            if (m.status === 'RUNNING') run     += live;
            if (m.status === 'IDLE')    idle    += live;
            if (m.status === 'ALARM')   alarm   += live;
            if (m.status === 'OFFLINE') offline += live;
            }
        }

    //   const planned = run + idle + alarm;
        const planned = run + idle + alarm + offline;
        return res.json({
            window: 'shift',
            run, idle, alarm, offline,
            availability: planned > 0 ? run / planned : 0
        });
    }

    // 8h or 24h → query hourly rows from DB
   // backend/node/routes/api/plantSummary.js
// replace the 8h/24h block:

    const hours = window === '24' ? 24 : 8;
    const pool  = await getDbPool();

    // Get all hourly rows in the window (hour_bucket IS NOT NULL)
    // Use N-1 complete hours from DB + current incomplete hour from stateStore
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const [rows] = await pool.query(
      `SELECT SUM(run_seconds) AS run, SUM(idle_seconds) AS idle,
              SUM(alarm_seconds) AS alarm, SUM(offline_seconds) AS offline
       FROM machine_shift_status
       WHERE hour_bucket IS NOT NULL AND hour_bucket != '1970-01-01 00:00:00' AND hour_bucket >= ?`,
      [since.toISOString().slice(0, 19).replace('T', ' ')]
    );

    const r   = rows[0];
    // DB totals (complete + current hour's last written snapshot)
    let run     = Number(r.run)     || 0;
    let idle    = Number(r.idle)    || 0;
    let alarm   = Number(r.alarm)   || 0;
    let offline = Number(r.offline) || 0;

    // Add the current incomplete hour from live stateStore
    // (hourly rows only update every 60s so the last ~60s is missing from DB)
    const machines = global.services.stateStore.getPlcSnapshot().machines;
    let liveRun = 0, liveIdle = 0, liveAlarm = 0, liveOffline = 0;

    // current hour bucket
    const currentBucket = new Date();
    currentBucket.setMinutes(0, 0, 0);

    for (const m of Object.values(machines)) {
      if (!m.shiftDurations || !m.statusStartedAt) continue;
      const live = Math.floor((Date.now() - m.statusStartedAt) / 1000);
      if (m.status === 'RUNNING') liveRun     += live;
      if (m.status === 'IDLE')    liveIdle    += live;
      if (m.status === 'ALARM')   liveAlarm   += live;
      if (m.status === 'OFFLINE') liveOffline += live;
    }

    const totalRun     = run     + liveRun;
    const totalIdle    = idle    + liveIdle;
    const totalAlarm   = alarm   + liveAlarm;
    const totalOffline = offline + liveOffline;
    // const planned      = totalRun + totalIdle + totalAlarm;
    const planned = totalRun + totalIdle + totalAlarm + totalOffline;

    res.json({
      window: `${hours}h`,
      run:     totalRun,
      idle:    totalIdle,
      alarm:   totalAlarm,
      offline: totalOffline,
      availability: planned > 0 ? totalRun / planned : 0
    });

  } catch (err) {
    console.error('plantSummary error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;