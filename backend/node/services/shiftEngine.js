// backend/node/services/shiftEngine.js

const stateStore = require('./stateStore');
const persistenceEngine = require('./persistenceEngine');

function getShiftInfo(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  let shift;

  if (hour >= 6 && hour < 14) shift = 'A';
  else if (hour >= 14 && hour < 22) shift = 'B';
  else shift = 'C';

  let shiftDate = new Date(date);

  // Shift C before 06:00 belongs to previous day
  if (shift === 'C' && hour < 6) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return {
    shift,
    date: shiftDate.toISOString().slice(0, 10)
  };
}

function getNextShiftBoundary(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  const hour = now.getHours();

  if (hour < 6) next.setHours(6, 0, 0, 0);
  else if (hour < 14) next.setHours(14, 0, 0, 0);
  else if (hour < 22) next.setHours(22, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }

  return next;
}

function calculateAvailability(d) {
  const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds;

  if (planned === 0) return 0;

  return d.run_seconds / planned;
}

async function closeShiftForMachine(machine) {

  const durations = machine.shiftDurations;

  const availability = calculateAvailability(durations);

  await persistenceEngine.saveMachineShift({
    ...machine,
    availability
  });
}

async function openNewShiftForMachine(machine, now) {

  const shiftInfo = getShiftInfo(now);

  machine.shift = shiftInfo.shift;
  machine.shiftDate = shiftInfo.date;

  machine.shiftDurations = {
    run_seconds: 0,
    idle_seconds: 0,
    alarm_seconds: 0,
    offline_seconds: 0
  };

  machine.statusStartedAt = now;

  // create new zero row immediately
  await persistenceEngine.saveMachineShift({
    ...machine,
    availability: 0
  });
}

async function processShiftBoundary() {

  console.log("🔄 SHIFT BOUNDARY TRIGGERED");

  const machines = stateStore.getPlcSnapshot().machines;
  const now = Date.now();

  for (const machine of Object.values(machines)) {

    // 1️⃣ Close old shift
    await closeShiftForMachine(machine);

    // 2️⃣ Open new shift
    await openNewShiftForMachine(machine, now);
  }

  console.log("✅ New shift initialized");

  const snapshot = stateStore.getPlcSnapshot();

  global.services.plcMonitor.broadcast({
    type: 'plc_snapshot',
    payload: snapshot
  });
}

function scheduleShiftBoundary() {
  const now = new Date();
  const next = getNextShiftBoundary(now);
  const delay = next.getTime() - now.getTime();

  console.log("⏳ Next shift boundary at:", next);

  setTimeout(async () => {
    await processShiftBoundary();
    scheduleShiftBoundary();
  }, delay);
}

// Fallback if PLC event triggers shift mismatch
async function detectAndHandleShift(key) {

  const machine = stateStore.getPlc(key);
  if (!machine) return;

  const now = Date.now();
  const shiftInfo = getShiftInfo(now);

  if (
    machine.shift !== shiftInfo.shift ||
    machine.shiftDate !== shiftInfo.date
  ) {

    await closeShiftForMachine(machine);
    await openNewShiftForMachine(machine, now);
  }
}

module.exports = {
  detectAndHandleShift,
  scheduleShiftBoundary,
  getShiftInfo
};