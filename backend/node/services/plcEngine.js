// backend/node/services/plcEngine.js
const stateStore = require('./stateStore');
const shiftEngine = require('./shiftEngine');


function processUpdate(payload) {

  const { department, machine, metrics = {}, context = {}, timestamp } = payload;

  const key = `${department.toLowerCase()}_${machine}`;
  const machineState = stateStore.getPlc(key) || {};
  
  const now = Date.now();

  const newStatus = stateStore.deriveStatus(department, metrics);

  let durations = machineState.shiftDurations || {
    run_seconds: 0,
    idle_seconds: 0,
    alarm_seconds: 0,
    offline_seconds: 0
  };

  // accumulate previous state
  if (machineState.status) {
    const diff = Math.floor((now - machineState.statusStartedAt) / 1000);
    const bucketMap = {
      RUNNING: 'run_seconds',
      IDLE: 'idle_seconds',
      ALARM: 'alarm_seconds',
      OFFLINE: 'offline_seconds'
    };

    const bucket = bucketMap[machineState.status];
    if (bucket) durations[bucket] += diff;
  }

  const shiftInfo = shiftEngine.getShiftInfo(now);

  const updated = {
    department,
    machine,
    machineType: payload.machine_type,
    status: newStatus,
    statusStartedAt: now,
    shift: shiftInfo.shift,
    shiftDate: shiftInfo.date,
    shiftDurations: durations,
    timestamp: new Date(timestamp).getTime(),
    lastUpdate: now,
    context,
    tags: metrics
  };

  stateStore.updatePlcBase(key, updated);

  shiftEngine.detectAndHandleShift(key);
}

module.exports = { processUpdate };