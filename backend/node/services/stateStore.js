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

// function updatePlc(payload) {
//   const { department, machine, timestamp, data } = payload;
//   if (!department || !machine) return;

//   if (!runtimeState.plc[department]) {
//     runtimeState.plc[department] = {};
//   }

//   runtimeState.plc[department][machine] = {
//     lastUpdate: new Date(timestamp).getTime(),
//     data
//   };
// }
function deriveStatus(metrics = {}) {
  if (metrics.alarm) return 'ALARM';
  if (metrics.run) return 'RUNNING';
  if (metrics.idle) return 'IDLE';
  return 'STOP';
}

function updatePlc(payload) {
  const { department, machine, machine_type, timestamp, metrics = {}, context = {} } = payload;
  if (!department || !machine) return;

  const key = `${department.toLowerCase()}_${machine}`;

  runtimeState.plc[key] = {
    department,
    machineType: machine_type,
    status: deriveStatus(metrics),
    timestamp: new Date(timestamp).getTime(),
    lastUpdate: Date.now(),

    context: {
      operator_id: context.operator_id ?? null,
      part_name: context.part_name ?? null,
      plan: context.plan ?? null
    },

    tags: {
      cycle_time: metrics.cycle_time ?? null,
      count_today: metrics.count_today ?? null
    },

    alarms: metrics.alarm
      ? [metrics.alarm_code]
      : []
  };
}

// function getPlcSnapshot() {
//   const machines = {};

//   for (const dept in runtimeState.plc) {
//     for (const mc in runtimeState.plc[dept]) {
//       const key = `${dept.toLowerCase()}_${mc}`;
//       machines[key] = runtimeState.plc[dept][mc];
//     }
//   }

//   return {
//     timestamp: Date.now(),
//     machines
//   };
// }
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

module.exports = {
  updatePlc,
  getPlcSnapshot,
  loadState,
  saveState
};

// const fs = require('fs');
// const path = require('path');

// const STATE_FILE = path.join(__dirname, '../data/systemState.json');

// function loadState() {
//   try {
//     if (!fs.existsSync(STATE_FILE)) {
//       return { lastIntent: 'STOPPED' };
//     }
//     const raw = fs.readFileSync(STATE_FILE, 'utf8');
//     return JSON.parse(raw);
//   } catch (err) {
//     console.error('❌ Failed to load system state:', err.message);
//     return { lastIntent: 'STOPPED' };
//   }
// }

// function saveState(state) {
//   try {
//     fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
//     fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
//   } catch (err) {
//     console.error('❌ Failed to save system state:', err.message);
//   }
// }

// module.exports = {
//   loadState,
//   saveState
// };
