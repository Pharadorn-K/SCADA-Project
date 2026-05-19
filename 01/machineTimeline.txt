// backend/node/routes/machineTimeline.js
const express = require('express');
const router  = express.Router();
const { getDbPool } = require('../services/db');


// derive status from a raw_* row (same logic as stateStore.deriveStatus)
function deriveStatus(department, row) {
  if (row.offline === 1) return 'OFFLINE';

  const noSignal = !row.run && !row.idle && !row.alarm &&
                   !(row.setting) && !(row.heat);
  if (noSignal) return 'OFFLINE';

  if (row.alarm === 1) return 'ALARM';

  if (department?.toLowerCase() === 'heat') {
    if (row.run === 1 || row.heat === 1) return 'RUNNING';
    if (row.run === 0 && row.heat === 0 && row.idle === 1) return 'IDLE';
    return 'STOP';
  }

  if (row.run === 1)  return 'RUNNING';
  if (row.idle === 1) return 'IDLE';
  return 'STOP';
}

const TABLE_MAP = {
  press: 'raw_press',
  heat:  'raw_heat',
  lathe: 'raw_lathe'
};

// GET /api/machine-timeline?dept=heat&machine=K7&from=2026-04-20T06:00:00&to=2026-04-20T14:00:00
router.get('/', async (req, res) => {
  try {
    const { dept, machine, from, to } = req.query;
    if (!dept || !machine || !from || !to) {
      return res.status(400).json({ error: 'dept, machine, from, to required' });
    }

    const deptKey = dept.toLowerCase();
    const table = TABLE_MAP[deptKey];
    if (!table) return res.status(400).json({ error: 'unknown dept' });

    const fromDt = new Date(from);
    const toDt   = new Date(to);

    if (isNaN(fromDt) || isNaN(toDt)) {
      return res.status(400).json({ error: 'invalid date format' });
    }

    const pool = await getDbPool();

    // 1️⃣ Get the last row BEFORE the range so we know what state it started in
    const [beforeRows] = await pool.query(
      `SELECT * FROM ${table}
       WHERE machine = ? AND timestamp < ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [machine, fromDt]
    );

    // 2️⃣ Get all rows inside the range
    const [rows] = await pool.query(
      `SELECT * FROM ${table}
       WHERE machine = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
      [machine, fromDt, toDt]
    );

    // 3️⃣ Build segments
    // Combine: seed row (if exists) + in-range rows
    const allRows = beforeRows.length
      ? [{ ...beforeRows[0], timestamp: fromDt }, ...rows]
      : rows;

    if (!allRows.length) {
      return res.json({ segments: [], from: fromDt, to: toDt });
    }

    const segments = [];
    const rangeStartMs = fromDt.getTime();
    const rangeEndMs   = toDt.getTime();

    for (let i = 0; i < allRows.length; i++) {
      const row     = allRows[i];
      const next    = allRows[i + 1];
      const startMs = Math.max(new Date(row.timestamp).getTime(), rangeStartMs);
      const endMs   = next
        ? Math.min(new Date(next.timestamp).getTime(), rangeEndMs)
        : rangeEndMs;

      if (endMs <= startMs) continue;

      segments.push({
        status:    deriveStatus(deptKey, row),
        startMs,
        endMs,
        durationMs: endMs - startMs,
        part_name:  row.part_name ?? '',
        alarm_code: row.alarm_code ?? 0
      });
    }

    res.json({
      machine,
      dept,
      from:     fromDt.toISOString(),
      to:       toDt.toISOString(),
      segments
    });

  } catch (err) {
    console.error('Timeline error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;