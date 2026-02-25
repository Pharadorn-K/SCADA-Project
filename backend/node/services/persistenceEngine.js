// backend/node/services/persistenceEngine.js
const stateStore = require('./stateStore');
const { getDbPool } = require('./db');

async function saveAllShifts() {

  const pool = await getDbPool();
  const machines = stateStore.getPlcSnapshot().machines;

  for (const [key, machine] of Object.entries(machines)) {

    if (!machine.shiftDurations) continue;

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
        machine.machine,
        machine.shiftDurations.run_seconds,
        machine.shiftDurations.idle_seconds,
        machine.shiftDurations.alarm_seconds,
        machine.shiftDurations.offline_seconds
      ]
    );
  }
}

function startAutoSave() {
  setInterval(saveAllShifts, 60 * 1000);
}

async function saveMachineShift(machine) {
  const pool = await getDbPool();

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
      machine.machine,
      machine.shiftDurations.run_seconds,
      machine.shiftDurations.idle_seconds,
      machine.shiftDurations.alarm_seconds,
      machine.shiftDurations.offline_seconds
    ]
  );
}

function accumulateCurrentStatus(machine) {
  const now = Date.now();
  const diff = Math.floor((now - machine.statusStartedAt) / 1000);

  const bucketMap = {
    RUNNING: 'run_seconds',
    IDLE: 'idle_seconds',
    ALARM: 'alarm_seconds',
    OFFLINE: 'offline_seconds'
  };

  const bucket = bucketMap[machine.status];
  if (bucket) {
    machine.shiftDurations[bucket] += diff;
  }

  machine.statusStartedAt = now;
}

function scheduleNextShiftCheck() {
  const now = new Date();
  const next = calculateNextShiftBoundary(now);

  const delay = next.getTime() - now.getTime();

  setTimeout(() => {
    processShiftBoundary();
    scheduleNextShiftCheck();
  }, delay);
}
module.exports = {
  saveMachineShift,
  accumulateCurrentStatus,
  scheduleNextShiftCheck,
  startAutoSave
};
