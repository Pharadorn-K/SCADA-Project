// backend/node/services/plcEngine.js
const stateStore = require('./stateStore');
const shiftEngine = require('./shiftEngine');


function processUpdate(payload) {

  const { department, machine, metrics = {}, context = {}, timestamp } = payload;
  const key = `${department.toLowerCase()}_${machine}`;
  const machineState = stateStore.getPlc(key) || {};
  const now = Date.now();
  const newStatus = stateStore.deriveStatus(department, metrics);

  let durations =
    payload.shiftDurations ||
    machineState.shiftDurations || {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };

  const shiftInfo = shiftEngine.getShiftInfo(now);
  // 🔥 Build cycleHistory: start from existing, or seed from bootstrap payload
  let cycleHistory = machineState.cycleHistory ?? payload.cycleHistory ?? [];

  // Push new entry only if cycle_time is valid and changed
  const newCycleTime = metrics.cycle_time;
  const lastEntry = cycleHistory[cycleHistory.length - 1];

  if (newCycleTime > 0 && newCycleTime !== lastEntry?.v) {
    cycleHistory = [
      ...cycleHistory,
      { v: newCycleTime, t: timestamp }
    ].slice(-30); // keep only last 30
  }
  const updated = {
    department,
    machine,
    machineType: payload.machine_type,
    status: newStatus,
    statusStartedAt: machineState.status !== newStatus
      ? now
      : machineState.statusStartedAt || now,
    shift: shiftInfo.shift,
    shiftDate: shiftInfo.date,
    shiftDurations: durations,
    timestamp: new Date(timestamp).getTime(),
    lastUpdate: now,
    context,
    tags: metrics
  };
    stateStore.updatePlcBase(key, updated);
  // stateStore.upd
  shiftEngine.detectAndHandleShift(key);
}

module.exports = { processUpdate };