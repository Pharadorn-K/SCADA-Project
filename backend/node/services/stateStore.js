// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const STATE_FILE = path.join(__dirname, '../data/systemState.json');

let dbPool = null;
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


// function updatePlc(payload) {
//   const { department, machine, machine_type, timestamp, metrics = {}, context = {} } = payload;
//   if (!department || !machine) return;

//   const key = `${department.toLowerCase()}_${machine}`;

//   const prev = runtimeState.plc[key] || {};

//   runtimeState.plc[key] = {
//     ...prev,
//     department,
//     machineType: machine_type,
//     status: deriveStatus(department, metrics),

//     timestamp: new Date(timestamp).getTime(),
//     lastUpdate: Date.now(),

//     context: {
//       ...prev.context,
//       operator_id: context.operator_id ?? prev.context?.operator_id ?? null,
//       part_name: context.part_name ?? prev.context?.part_name ?? null,
//       plan: context.plan ?? prev.context?.plan ?? null
//     },

//     tags: {
//       ...prev.tags,
//       ...(metrics.cycle_time !== undefined && {
//         cycle_time: metrics.cycle_time
//       }),
//       ...(metrics.count_today !== undefined && {
//         count_today: metrics.count_today
//       })
//     },

//     alarms: metrics.alarm
//       ? [metrics.alarm_code]
//       : []
//   };

// }
function updatePlc(payload) {
  const { department, machine, machine_type, timestamp, metrics = {}, context = {} } = payload;
  if (!department || !machine) return;

  const key = `${department.toLowerCase()}_${machine}`;
  const prev = runtimeState.plc[key] || {};

  // 🆕 handle cycle history
  let cycleHistory = prev.cycleHistory || [];

  if (metrics.cycle_time !== undefined && metrics.cycle_time > 0) {
    cycleHistory = [...cycleHistory, metrics.cycle_time];

    if (cycleHistory.length > 10) {
      cycleHistory.shift();
    }
  }

  runtimeState.plc[key] = {
    ...prev,
    department,
    machineType: machine_type,
    status: deriveStatus(department, metrics),

    timestamp: new Date(timestamp).getTime(),
    lastUpdate: Date.now(),

    context: {
      ...prev.context,
      operator_id: context.operator_id ?? prev.context?.operator_id ?? null,
      part_name: context.part_name ?? prev.context?.part_name ?? null,
      plan: context.plan ?? prev.context?.plan ?? null
    },

    tags: {
      ...prev.tags,
      ...(metrics.cycle_time !== undefined && {
        cycle_time: metrics.cycle_time
      }),
      ...(metrics.count_today !== undefined && {
        count_today: metrics.count_today
      })
    },

    cycleHistory, // 👈 ADD THIS

    alarms: metrics.alarm ? [metrics.alarm_code] : []
  };
}

function getPlcSnapshot() {
  return {
    timestamp: Date.now(),
    machines: { ...runtimeState.plc }
  };
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
async function getDbPool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || '10.207.1.87',
      user: process.env.DB_USER || 'PESET123',
      password: process.env.DB_PASS || '123456',
      database: process.env.DB_NAME || 'scada',
      waitForConnections: true,
      connectionLimit: 5
    });
  }
  return dbPool;
}

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
      count_today: row.count_today ?? 0,
      count_signal: row.count_signal ?? 0,

      // Optional per department
      heat: row.heat ?? 0,
      setting: row.setting ?? 0
    }
  };
}

async function hydrateFromDatabase() {
  const pool = await getDbPool();

  const departments = [
    { table: 'raw_press' },
    { table: 'raw_heat' },
    { table: 'raw_lathe' }
  ];

  for (const { table } of departments) {
    console.log(`🔄 Hydrating from ${table}...`);

    // Get distinct machines first
    const [machines] = await pool.query(
      `SELECT DISTINCT machine FROM ${table}`
    );

    for (const m of machines) {
      const machine = m.machine;

      // Smart ordering:
      // 1️⃣ prefer count_signal=1 count_signal DESC,
      // 2️⃣ newest row
      const [rows] = await pool.query(
        `
        SELECT *
        FROM ${table}
        WHERE machine = ?
        ORDER BY id_row DESC
        LIMIT 1
        `,
        [machine]
      );

      if (!rows.length) continue;

      const normalized = normalizeRow(rows[0]);

      // 1️⃣ update latest machine state
      updatePlc(normalized);
    }
  }

  console.log('✅ State hydration complete');
}

module.exports = {
  updatePlc,
  getPlcSnapshot,
  loadState,
  saveState,
  hydrateFromDatabase
};
