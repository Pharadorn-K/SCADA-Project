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


function detectAndHandleShift(key) {

  const machine = stateStore.getPlc(key);
  if (!machine) return;   // 🛡 safety guard

  const now = Date.now();
  const shiftInfo = getShiftInfo(now);
  
  if (
    machine.shift !== shiftInfo.shift ||
    machine.shiftDate !== shiftInfo.date
  ) {

    // save old shift
    persistenceEngine.saveMachineShift(machine);

    // reset
    machine.shift = shiftInfo.shift;
    machine.shiftDate = shiftInfo.date;
    machine.shiftDurations = {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };

    machine.statusStartedAt = now;
  }
}

module.exports = { detectAndHandleShift, getShiftInfo };