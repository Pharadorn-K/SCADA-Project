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


module.exports = {
  deriveStatus,
  updatePlcBase,
  getPlcSnapshot,
  getPlc,
  loadState,
  saveState,
};
