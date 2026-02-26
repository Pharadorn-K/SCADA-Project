// backend/node/services/bootstrapEngine.js
const { getDbPool } = require('./db');
const plcEngine = require('./plcEngine');

function normalizeRow(row) {
  return {
    department: row.department,
    machine: row.machine,
    machine_type: row.machine_type,
    timestamp: row.timestamp,

    context: {
      part_name: row.part_name ?? '',
      plan: row.plan ?? 0,
      operator_id: row.operator_id ?? ''
    },

    metrics: {
      run: row.run ?? 0,
      idle: row.idle ?? 0,
      alarm: row.alarm ?? 0,
      offline: row.offline ?? 0,
      alarm_code: row.alarm_code ?? 0,
      cycle_time: row.cycle_time ?? 0,
      count_shift: row.count_shift ?? 0,
      count_signal: row.count_signal ?? 0,
      heat: row.heat ?? 0,
      setting: row.setting ?? 0
    }
  };
}

async function hydrate() {
  const pool = await getDbPool();

  const tables = ['raw_press', 'raw_heat', 'raw_lathe'];

  for (const table of tables) {

    console.log(`🔄 Hydrating from ${table}...`);

    const [machines] = await pool.query(
      `SELECT DISTINCT machine FROM ${table}`
    );

    for (const m of machines) {

      const [rows] = await pool.query(
        `
        SELECT *
        FROM ${table}
        WHERE machine = ?
        ORDER BY id_row DESC
        LIMIT 1
        `,
        [m.machine]
      );

      if (!rows.length) continue;

      const normalized = normalizeRow(rows[0]);
      // 🔥 1️⃣ Get current shift info
      const shiftEngine = require('./shiftEngine');
      const shiftInfo = shiftEngine.getShiftInfo(Date.now());

      // 🔥 2️⃣ Load saved shift durations
      const [shiftRows] = await pool.query(
        `
        SELECT run_seconds, idle_seconds,
              alarm_seconds, offline_seconds
        FROM machine_shift_status
        WHERE date = ?
          AND shift = ?
          AND department = ?
          AND machine = ?
        LIMIT 1
        `,
        [
          shiftInfo.date,
          shiftInfo.shift,
          normalized.department,
          normalized.machine
        ]
      );

      if (shiftRows.length) {
        normalized.shiftDurations = {
          run_seconds: shiftRows[0].run_seconds,
          idle_seconds: shiftRows[0].idle_seconds,
          alarm_seconds: shiftRows[0].alarm_seconds,
          offline_seconds: shiftRows[0].offline_seconds
        };
      } else {
        normalized.shiftDurations = {
          run_seconds: 0,
          idle_seconds: 0,
          alarm_seconds: 0,
          offline_seconds: 0
        };
      }
      // 🔥 IMPORTANT: use plcEngine only
      plcEngine.processUpdate(normalized);
    }
  }

  console.log('✅ Hydration complete (clean architecture)');
}

module.exports = { hydrate };