// backend/node/services/bootstrapEngine.js
const { getDbPool } = require('./db');
const plcEngine    = require('./plcEngine');

function normalizeRow(row) {
  return {
    department: row.department,
    machine:    row.machine,
    machine_type: row.machine_type,
    timestamp:  row.timestamp,
    context: {
      part_name:   row.part_name   ?? '',
      plan:        row.plan        ?? 0,
      operator_id: row.operator_id ?? ''
    },
    metrics: {
      run:          row.run          ?? 0,
      idle:         row.idle         ?? 0,
      alarm:        row.alarm        ?? 0,
      offline:      row.offline      ?? 0,
      alarm_code:   row.alarm_code   ?? 0,
      cycle_time:   row.cycle_time   ?? 0,
      count_shift:  row.count_shift  ?? 0,
      count_signal: row.count_signal ?? 0,
      heat:         row.heat         ?? 0,
      setting:      row.setting      ?? 0
    }
  };
}

async function hydrate() {
  const pool       = await getDbPool();
  const shiftEngine = require('./shiftEngine');
  const tables     = ['raw_press', 'raw_heat', 'raw_lathe'];
  const SHIFT_BUCKET = '1970-01-01 00:00:00';

  for (const table of tables) {
    console.log(`🔄 Hydrating from ${table}...`);

    const [machines] = await pool.query(
      `SELECT DISTINCT machine FROM ${table}`
    );

    for (const m of machines) {

      // ── 1. Last raw event row ────────────────────────────────────────
      const [rows] = await pool.query(
        `SELECT * FROM ${table} WHERE machine = ? ORDER BY id_row DESC LIMIT 1`,
        [m.machine]
      );
      if (!rows.length) continue;

      const normalized = normalizeRow(rows[0]);

      // ── 2. Determine what the CURRENT shift is RIGHT NOW ─────────────
      const shiftInfo = shiftEngine.getShiftInfo(Date.now());

      const [existingShift] = await pool.query(
        `SELECT run_seconds, idle_seconds, alarm_seconds, offline_seconds
        FROM machine_shift_status
        WHERE date = ? AND shift = ? AND department = ? AND machine = ?
          AND hour_bucket = ?
        LIMIT 1`,
        [shiftInfo.date, shiftInfo.shift, normalized.department, normalized.machine, SHIFT_BUCKET]
      );

      if (existingShift.length) {
        // Resume existing shift durations
        normalized.shiftDurations = {
          run_seconds:     existingShift[0].run_seconds,
          idle_seconds:    existingShift[0].idle_seconds,
          alarm_seconds:   existingShift[0].alarm_seconds,
          offline_seconds: existingShift[0].offline_seconds
        };
        console.log(`  ↩ Resumed ${normalized.department}/${normalized.machine} shift ${shiftInfo.shift} from DB`);
      } else {
        // No row yet for this shift — start from zero and create it
        normalized.shiftDurations = {
          run_seconds:     0,
          idle_seconds:    0,
          alarm_seconds:   0,
          offline_seconds: 0
        };

      await pool.query(
        `INSERT INTO machine_shift_status
          (date, shift, hour_bucket, department, machine,
            run_seconds, idle_seconds, alarm_seconds, offline_seconds, availability)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0)
        ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [shiftInfo.date, shiftInfo.shift, SHIFT_BUCKET, normalized.department, normalized.machine]
      );
        console.log(`  ✨ Created new shift row for ${normalized.department}/${normalized.machine} shift ${shiftInfo.shift}`);
      }

      // ── 4. Load last 50 cycle times ──────────────────────────────────
      const [cycleRows] = await pool.query(
        `SELECT cycle_time, timestamp FROM ${table}
         WHERE machine = ? AND cycle_time > 0
         ORDER BY id_row DESC LIMIT 50`,
        [m.machine]
      );
      normalized.cycleHistory = cycleRows
        .reverse()
        .map(r => ({ v: r.cycle_time, t: r.timestamp }));

      plcEngine.processUpdate(normalized);
    }
  }

  console.log('✅ Hydration complete');
}

module.exports = { hydrate };