// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, '../data/systemState.json');


let runtimeState = {
  plc: {},          // 👈 LIVE PLC DATA
  meta: {
    lastIntent: 'STOPPED'
  }
};

/* ------------------ PLC STATE ------------------ */
function deriveStatus(department, metrics = {}) {
  // 1️⃣ Explicit offline
  if (metrics.offline === 1) return 'OFFLINE';

  const noSignal =
    !metrics.run &&
    !metrics.idle &&
    !metrics.alarm &&
    !metrics.setting &&
    !metrics.heat;

  if (noSignal) return 'OFFLINE';

  // 2️⃣ Alarm priority
  if (metrics.alarm === 1) return 'ALARM';

  // 3️⃣ Department-specific logic
  if (department?.toLowerCase() === 'heat') {
    // Heat rule:
    if (metrics.run === 1 || metrics.heat === 1) {
      return 'RUNNING';
    }

    if (
      metrics.run === 0 &&
      metrics.heat === 0 &&
      metrics.idle === 1
    ) {
      return 'IDLE';
    }

    return 'STOP';
  }

  // 4️⃣ Default logic (Press, Lathe, etc.)
  if (metrics.run === 1) return 'RUNNING';
  if (metrics.idle === 1) return 'IDLE';

  return 'STOP';
}

function updatePlcBase(key, data) {
  runtimeState.plc[key] = {
    ...runtimeState.plc[key],
    ...data
  };
}

function getPlcSnapshot() {
  return {
    timestamp: Date.now(),
    machines: { ...runtimeState.plc }
  };
}

function getPlc(key) {
  return runtimeState.plc[key] || null;
}


/* ------------------ SYSTEM STATE ------------------ */
function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return runtimeState.meta;
    runtimeState.meta = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return runtimeState.meta;
  } catch {
    return runtimeState.meta;
  }
}

function saveState(state) {
  runtimeState.meta = { ...runtimeState.meta, ...state };
  fs.writeFileSync(STATE_FILE, JSON.stringify(runtimeState.meta, null, 2));
}

/* ------------------ DB ------------------ */
// const { getDbPool } = require('./db');

// function normalizeRow(row) {
//   return {
//     department: row.department,
//     machine: row.machine,
//     machine_type: row.machine_type,
//     timestamp: row.timestamp,

//     context: {
//       part_name: row.part_name ?? '',
//       plan: row.plan ?? 0,
//       operator_id: row.operator_id ?? ''
//     },

//     metrics: {
//       run: row.run ?? 0,
//       idle: row.idle ?? 0,
//       alarm: row.alarm ?? 0,
//       offline: row.offline ?? 0,
//       alarm_code: row.alarm_code ?? 0,
//       cycle_time: row.cycle_time ?? 0,
//       count_shift: row.count_shift ?? 0,
//       count_signal: row.count_signal ?? 0,

//       // Optional per department
//       heat: row.heat ?? 0,
//       setting: row.setting ?? 0
//     }
//   };
// }

// async function hydrateFromDatabase() {
//   const pool = await getDbPool();

//   const departments = [
//     { table: 'raw_press' },
//     { table: 'raw_heat' },
//     { table: 'raw_lathe' }
//   ];

//   for (const { table } of departments) {
//     console.log(`🔄 Hydrating from ${table}...`);

//     // Get distinct machines first
//     const [machines] = await pool.query(
//       `SELECT DISTINCT machine FROM ${table}`
//     );

//     for (const m of machines) {
//       const machine = m.machine;
//       // Smart ordering:
//       const [rows] = await pool.query(
//         `
//         SELECT *
//         FROM ${table}
//         WHERE machine = ?
//         ORDER BY id_row DESC
//         LIMIT 1
//         `,
//         [machine]
//       );
      
//       // Load last 30 cycle_time history
//       const [cycleRows] = await pool.query(
//         `
//         SELECT timestamp, cycle_time
//         FROM ${table}
//         WHERE machine = ?
//           AND count_signal = 1
//           AND cycle_time > 0
//         ORDER BY id_row DESC
//         LIMIT 30
//         `,
//         [machine]
//       );

//       if (!rows.length) continue;

//       const normalized = normalizeRow(rows[0]);
//       const history = cycleRows
//         .reverse() // oldest → newest
//         .map(r => ({
//           t: new Date(r.timestamp).getTime(),
//           v: r.cycle_time
//         }));

//       const plcEngine = require('./plcEngine');

//       plcEngine.processUpdate({
//         ...normalized,
//         __hydratedHistory: history
//       });

//       // update shift durations
//       // const shiftInfo = shiftEngine.getShiftInfo();

//       const [shiftRows] = await pool.query(
//         `
//         SELECT run_seconds, idle_seconds,
//               alarm_seconds, offline_seconds
//         FROM machine_shift_status
//         WHERE date = ?
//           AND shift = ?
//           AND department = ?
//           AND machine = ?
//         `,
//         [
//           shiftInfo.date,
//           shiftInfo.shift,
//           normalized.department,
//           normalized.machine
//         ]
//       );

//       if (shiftRows.length) {
//         const machineKey = `${normalized.department.toLowerCase()}_${normalized.machine}`;
//         runtimeState.plc[machineKey].shiftDurations = {
//           run_seconds: shiftRows[0].run_seconds,
//           idle_seconds: shiftRows[0].idle_seconds,
//           alarm_seconds: shiftRows[0].alarm_seconds,
//           offline_seconds: shiftRows[0].offline_seconds
//         };
//       }
//     }

//   }
//   console.log('✅ State hydration complete');
// }
// async function saveShiftDurations() {
//   const pool = await getDbPool();

//   for (const [key, machine] of Object.entries(runtimeState.plc)) {

//     if (!machine.shiftDurations) continue;

//     const now = Date.now();
//     const diff = Math.floor((now - machine.statusStartedAt) / 1000);

//     const statusMap = {
//       RUNNING: 'run_seconds',
//       IDLE: 'idle_seconds',
//       ALARM: 'alarm_seconds',
//       OFFLINE: 'offline_seconds'
//     };

//     const bucket = statusMap[machine.status];
//     if (bucket) {
//       machine.shiftDurations[bucket] += diff;
//       machine.statusStartedAt = now;
//     }

//     await pool.query(
//       `
//       INSERT INTO machine_shift_status
//       (date, shift, department, machine,
//       run_seconds, idle_seconds,
//       alarm_seconds, offline_seconds)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//       ON DUPLICATE KEY UPDATE
//         run_seconds = VALUES(run_seconds),
//         idle_seconds = VALUES(idle_seconds),
//         alarm_seconds = VALUES(alarm_seconds),
//         offline_seconds = VALUES(offline_seconds)
//       `,
//       [
//         machine.shiftDate,
//         machine.shift,
//         machine.department,
//         key.split('_')[1],
//         machine.shiftDurations.run_seconds,
//         machine.shiftDurations.idle_seconds,
//         machine.shiftDurations.alarm_seconds,
//         machine.shiftDurations.offline_seconds
//       ]
//     );
//   }
// }

// setInterval(saveShiftDurations, 1 * 60 * 1000);    

module.exports = {
  deriveStatus,
  updatePlcBase,
  getPlcSnapshot,
  getPlc,
  loadState,
  saveState,
  // hydrateFromDatabase
};
