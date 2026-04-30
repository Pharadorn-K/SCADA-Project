
// backend/node/services/shiftEngine.js
const stateStore     = require('./stateStore');
const persistenceEngine = require('./persistenceEngine');

// ── Shift boundary definitions ──────────────────────────────────────────
// Returns { shift, date } where date is always the START DATE of that shift
function getShiftInfo(timestamp = Date.now()) {
  const d    = new Date(timestamp);
  const hour = d.getHours();

  let shift;
  let shiftDate = new Date(d);

  if (hour >= 6 && hour < 14) {
    shift = 'A';
    // date = today
  } else if (hour >= 14 && hour < 22) {
    shift = 'B';
    // date = today
  } else {
    shift = 'C';
    // Shift C that started YESTERDAY (00:00–05:59 the next day)
    if (hour < 6) {
      shiftDate.setDate(shiftDate.getDate() - 1);
    }
    // Shift C that started TODAY at 22:00 → date = today (no adjustment needed)
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

  if      (hour < 6)  next.setHours(6,  0, 0, 0);
  else if (hour < 14) next.setHours(14, 0, 0, 0);
  else if (hour < 22) next.setHours(22, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }

  return next;
}

// function calculateAvailability(d) {
//   const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds;
//   return planned === 0 ? 0 : d.run_seconds / planned;
// }
function calculateAvailability(d) {
  const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds + d.offline_seconds;
  return planned === 0 ? 0 : d.run_seconds / planned;
}

// ── Close old shift (save final availability) ───────────────────────────
async function closeShiftForMachine(machine) {
  const availability = calculateAvailability(machine.shiftDurations);
  try {
    await persistenceEngine.saveMachineShift({ ...machine, availability });
  } catch (e) {
    console.error('closeShiftForMachine error:', e.message);
  }
}

// ── Open new shift (reset durations, create zero row) ───────────────────
async function openNewShiftForMachine(machine, now) {
  const shiftInfo = getShiftInfo(now);
  machine.shift       = shiftInfo.shift;
  machine.shiftDate   = shiftInfo.date;
  machine.shiftDurations = {
    run_seconds:     0,
    idle_seconds:    0,
    alarm_seconds:   0,
    offline_seconds: 0
  };
  machine.statusStartedAt = now;
  try {
    await persistenceEngine.saveMachineShift({ ...machine, availability: 0 });
  } catch (e) {
    console.error('openNewShiftForMachine error:', e.message);
  }
}

// ── Shift boundary: close all + open all ────────────────────────────────
async function processShiftBoundary() {
  console.log('🔄 SHIFT BOUNDARY TRIGGERED');
  const machines = stateStore.getPlcSnapshot().machines;
  const now      = Date.now();

  for (const machine of Object.values(machines)) {
    await closeShiftForMachine(machine);
    await openNewShiftForMachine(machine, now);
  }

  console.log('✅ New shift initialized');
  console.log('⏳ Next shift boundary at:', getNextShiftBoundary());

  global.services?.plcMonitor?.broadcast({
    type: 'plc_snapshot',
    payload: stateStore.getPlcSnapshot()
  });
}

// function scheduleShiftBoundary() {
//   const now   = new Date();
//   const next  = getNextShiftBoundary(now);
//   const delay = next.getTime() - now.getTime();
//   console.log('⏳ Next shift boundary at:', next.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));

//   setTimeout(async () => {
//     await processShiftBoundary();
//     scheduleShiftBoundary();
//   }, delay);
// }

function scheduleShiftBoundary() {
  const now   = new Date();
  const next  = getNextShiftBoundary(now);
  const delay = next.getTime() - now.getTime();

  console.log('⏳ Next shift boundary at:',
    next.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));

  setTimeout(async () => {
    await processShiftBoundary();
    scheduleShiftBoundary(); // reschedule immediately after processing
  }, delay);
}

// Called once on bootstrap — checks if we missed a boundary while server was down
async function checkMissedBoundary() {
  const machines  = stateStore.getPlcSnapshot().machines;
  const shiftInfo = getShiftInfo(Date.now());
  let anyMismatch = false;

  for (const machine of Object.values(machines)) {
    if (machine.shift !== shiftInfo.shift || machine.shiftDate !== shiftInfo.date) {
      anyMismatch = true;
      break;
    }
  }

  if (anyMismatch) {
    console.log('⚠️  Missed shift boundary detected on startup — processing now');
    await processShiftBoundary();
  } else {
    console.log('✅ Shift boundary check passed — current shift matches DB');
  }
}


// ── detectAndHandleShift: called on PLC event ───────────────────────────
// Guard: only acts if shift actually changed — prevents thrashing
const _shiftChangeInProgress = new Set();

async function detectAndHandleShift(key) {
  // Prevent concurrent handling for the same machine
  if (_shiftChangeInProgress.has(key)) return;

  const machine   = stateStore.getPlc(key);
  if (!machine) return;

  const shiftInfo = getShiftInfo(Date.now());

  // No change → do nothing
  if (machine.shift === shiftInfo.shift && machine.shiftDate === shiftInfo.date) return;

  _shiftChangeInProgress.add(key);
  try {
    console.log(`🔄 Shift change detected for ${key}: ${machine.shiftDate}/${machine.shift} → ${shiftInfo.date}/${shiftInfo.shift}`);
    await closeShiftForMachine(machine);
    await openNewShiftForMachine(machine, Date.now());
  } finally {
    _shiftChangeInProgress.delete(key);
  }
}

module.exports = {
  detectAndHandleShift,
  scheduleShiftBoundary,
  checkMissedBoundary,    // ← export new function
  getShiftInfo,
  getNextShiftBoundary
};