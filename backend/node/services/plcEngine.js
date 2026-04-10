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

  let cycleHistory = machineState.cycleHistory?.length
    ? machineState.cycleHistory
    : (payload.cycleHistory ?? []);
  // Push new entry only if cycle_time is valid and changed
  // const newCycleTime = metrics.cycle_time;
  const prevCycleTime = machineState.tags?.cycle_time;
  const newCycleTime = metrics.cycle_time ?? prevCycleTime;
  const lastEntry = cycleHistory[cycleHistory.length - 1];

  if (newCycleTime > 0 && newCycleTime !== lastEntry?.v) {
    cycleHistory = [
      ...cycleHistory,
      { v: newCycleTime, t: timestamp }
    ].slice(-30); // keep only last 30
  }
  const prevTags = machineState.tags || {};
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
    cycleHistory,
    tags: {
      ...prevTags,  // ← preserve cycle_time, count_shift from hydration
      ...Object.fromEntries(
        Object.entries(metrics).filter(([_, v]) => v !== undefined && v !== null)
      )
    }
  };

  stateStore.updatePlcBase(key, updated);
  shiftEngine.detectAndHandleShift(key);
  // console.log('metrics:', metrics);
  // console.log('cycle_time:', metrics.cycle_time);
}

module.exports = { processUpdate };