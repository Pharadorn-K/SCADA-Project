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

function updatePlc(payload) {
  const { department, machine, machine_type, timestamp, metrics = {}, context = {} } = payload;
  if (!department || !machine) return;
  // 🔥 TEMP STANDARD CYCLE TIME CONFIG
  const STANDARD_CYCLE_TIME = {
    press: 6.5,
    heat: 95,
    lathe: 90
  };

  const key = `${department.toLowerCase()}_${machine}`;
  const prev = runtimeState.plc[key] || {};


  // 🆕 handle cycle history (TIME WINDOW BASED)
  let cycleHistory = prev.cycleHistory || [];

  // 🔥 If hydrating from DB
  if (payload.__hydratedHistory) {
    cycleHistory = payload.__hydratedHistory;
  }

  if (metrics.cycle_time !== undefined && metrics.cycle_time > 0) {

    const point = {
      t: new Date(timestamp).getTime(),
      v: metrics.cycle_time
    };

    cycleHistory = [...cycleHistory, point];

    // ⏱ Keep only last 5 minutes
    const MAX_POINTS = 50;

    if (cycleHistory.length > MAX_POINTS) {
      cycleHistory = cycleHistory.slice(-MAX_POINTS);
    }

  }

  const statusMap = {
    RUNNING: 'run_seconds',
    IDLE: 'idle_seconds',
    ALARM: 'alarm_seconds',
    OFFLINE: 'offline_seconds'
  };  
  const now = Date.now();
  const newStatus = deriveStatus(department, metrics);
  
  let durations = prev.shiftDurations ?? {
    run_seconds: 0,
    idle_seconds: 0,
    alarm_seconds: 0,
    offline_seconds: 0
  };

  const prevStatus = prev.status;
  const prevStart = prev.statusStartedAt ?? now;

  // 🔥 ALWAYS accumulate previous state
  if (prevStatus) {
    const diff = Math.floor((now - prevStart) / 1000);
    const bucket = statusMap[prevStatus];

    if (bucket) {
      durations[bucket] += diff;
    }
  }

  const shiftInfo = getShiftInfo(now);

  // 🔥 If shift changed → reset durations
  if (
    prev.shift !== shiftInfo.shift ||
    prev.shiftDate !== shiftInfo.date
  ) {
    durations = {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };
  }


  runtimeState.plc[key] = {
    ...prev,
    department,
    machineType: machine_type,
    status: newStatus,
    
    statusStartedAt: now,

    shift: shiftInfo.shift,
    shiftDate: shiftInfo.date,
    shiftDurations: durations,

    timestamp: new Date(timestamp).getTime(),
    lastUpdate: Date.now(),
    standard_cycle_time:STANDARD_CYCLE_TIME[department?.toLowerCase()] ?? null,
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
      ...(metrics.count_shift !== undefined && {
        count_shift: metrics.count_shift
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

function getPlc(key) {
  return runtimeState.plc[key] || null;
}

function getShiftInfo(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  let shift;

  if (hour >= 6 && hour < 14) shift = 'A';
  else if (hour >= 14 && hour < 22) shift = 'B';
  else shift = 'C';

  // Shift date handling (very important for shift C)
  let shiftDate = new Date(date);

  if (shift === 'C' && hour < 6) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return {
    shift,
    date: shiftDate.toISOString().slice(0, 10) // YYYY-MM-DD
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
      count_shift: row.count_shift ?? 0,
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

      // Load last 30 cycle_time history
      const [cycleRows] = await pool.query(
        `
        SELECT timestamp, cycle_time
        FROM ${table}
        WHERE machine = ?
          AND count_signal = 1
          AND cycle_time > 0
        ORDER BY id_row DESC
        LIMIT 30
        `,
        [machine]
      );

      const history = cycleRows
        .reverse() // oldest → newest
        .map(r => ({
          t: new Date(r.timestamp).getTime(),
          v: r.cycle_time
        }));

      // update latest machine state
      updatePlc({
        ...normalized,
        __hydratedHistory: history
      });

      // update shift durations
      const shiftInfo = getShiftInfo();
      const [shiftRows] = await pool.query(
        `
        SELECT run_seconds, idle_seconds,
              alarm_seconds, offline_seconds
        FROM machine_shift_status
        WHERE date = ?
          AND shift = ?
          AND department = ?
          AND machine = ?
        `,
        [
          shiftInfo.date,
          shiftInfo.shift,
          normalized.department,
          normalized.machine
        ]
      );

      if (shiftRows.length) {
        const machineKey = `${normalized.department.toLowerCase()}_${normalized.machine}`;
        runtimeState.plc[machineKey].shiftDurations = {
          run_seconds: shiftRows[0].run_seconds,
          idle_seconds: shiftRows[0].idle_seconds,
          alarm_seconds: shiftRows[0].alarm_seconds,
          offline_seconds: shiftRows[0].offline_seconds
        };
      }
    }

  }
  console.log('✅ State hydration complete');
}
async function saveShiftDurations() {
  const pool = await getDbPool();

  for (const [key, machine] of Object.entries(runtimeState.plc)) {

    if (!machine.shiftDurations) continue;

    const now = Date.now();
    const diff = Math.floor((now - machine.statusStartedAt) / 1000);

    const statusMap = {
      RUNNING: 'run_seconds',
      IDLE: 'idle_seconds',
      ALARM: 'alarm_seconds',
      OFFLINE: 'offline_seconds'
    };

    const bucket = statusMap[machine.status];
    if (bucket) {
      machine.shiftDurations[bucket] += diff;
      machine.statusStartedAt = now;
    }

    await pool.query(
      `
      INSERT INTO machine_shift_status
      (date, shift, department, machine,
      run_seconds, idle_seconds,
      alarm_seconds, offline_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        run_seconds = VALUES(run_seconds),
        idle_seconds = VALUES(idle_seconds),
        alarm_seconds = VALUES(alarm_seconds),
        offline_seconds = VALUES(offline_seconds)
      `,
      [
        machine.shiftDate,
        machine.shift,
        machine.department,
        key.split('_')[1],
        machine.shiftDurations.run_seconds,
        machine.shiftDurations.idle_seconds,
        machine.shiftDurations.alarm_seconds,
        machine.shiftDurations.offline_seconds
      ]
    );
  }
}

setInterval(saveShiftDurations, 1 * 60 * 1000);    

module.exports = {
  updatePlc,
  getPlcSnapshot,
  getPlc,
  loadState,
  saveState,
  hydrateFromDatabase
};
