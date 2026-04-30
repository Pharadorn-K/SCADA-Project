// backend/node/services/persistenceEngine.js
const stateStore = require('./stateStore');
const { getDbPool } = require('./db');

const SHIFT_BUCKET = '1970-01-01 00:00:00'; // sentinel for shift rows

async function saveAllShifts() {
  const pool     = await getDbPool();
  const machines = stateStore.getPlcSnapshot().machines;

  for (const [key, machine] of Object.entries(machines)) {
    if (!machine.shiftDurations) continue;

    const d       = machine.shiftDurations;
    // const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds;
    // const avail   = planned > 0 ? d.run_seconds / planned : null;
    const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds + d.offline_seconds;
    const avail   = planned > 0 ? d.run_seconds / planned : null;

    await pool.query(
      `INSERT INTO machine_shift_status
         (date, shift, hour_bucket, department, machine,
          run_seconds, idle_seconds, alarm_seconds, offline_seconds, availability)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         run_seconds     = VALUES(run_seconds),
         idle_seconds    = VALUES(idle_seconds),
         alarm_seconds   = VALUES(alarm_seconds),
         offline_seconds = VALUES(offline_seconds),
         availability    = VALUES(availability),
         updated_at      = NOW()`,
      [
        machine.shiftDate,
        machine.shift,
        SHIFT_BUCKET,       // ← sentinel, not NULL
        machine.department,
        machine.machine,
        d.run_seconds,
        d.idle_seconds,
        d.alarm_seconds,
        d.offline_seconds,
        avail
      ]
    );
  }
}

function startAutoSave() {
  // Save every 60 seconds (was 30s — DB writes are cheap but no need to thrash)
  setInterval(saveAllShifts, 60 * 1000);
}

async function saveMachineShift(machine) {
  const pool    = await getDbPool();
  const d       = machine.shiftDurations;
  // const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds;
  // const avail   = machine.availability ?? (planned > 0 ? d.run_seconds / planned : 0);
  const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds + d.offline_seconds;
  const avail   = machine.availability ?? (planned > 0 ? d.run_seconds / planned : 0);

  await pool.query(
    `INSERT INTO machine_shift_status
       (date, shift, hour_bucket, department, machine,
        run_seconds, idle_seconds, alarm_seconds, offline_seconds, availability)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       run_seconds     = VALUES(run_seconds),
       idle_seconds    = VALUES(idle_seconds),
       alarm_seconds   = VALUES(alarm_seconds),
       offline_seconds = VALUES(offline_seconds),
       availability    = VALUES(availability),
       updated_at      = NOW()`,
    [
      machine.shiftDate,
      machine.shift,
      SHIFT_BUCKET,         // ← sentinel, not NULL
      machine.department,
      machine.machine,
      d.run_seconds,
      d.idle_seconds,
      d.alarm_seconds,
      d.offline_seconds,
      avail
    ]
  );
}

function startDurationTicker() {
  setInterval(() => {
    const machines = stateStore.getPlcSnapshot().machines;
    for (const machine of Object.values(machines)) {
      if (!machine.status || !machine.shiftDurations) continue;
      const bucketMap = {
        RUNNING: 'run_seconds',
        IDLE:    'idle_seconds',
        ALARM:   'alarm_seconds',
        OFFLINE: 'offline_seconds'
      };
      const bucket = bucketMap[machine.status];
      if (bucket) machine.shiftDurations[bucket] += 1;
    }
  }, 1000);
}

module.exports = {
  saveMachineShift,
  startAutoSave,
  startDurationTicker
};