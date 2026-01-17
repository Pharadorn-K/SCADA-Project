// backend/node/services/alarmService.js
const alarms = [];
let lastAlarmCode = null;

function raise(code, message, severity = 'ERROR') {
  if (code === lastAlarmCode) return;

  const alarm = {
    id: Date.now(),              // 👈 unique ID
    time: new Date().toISOString(),
    code,
    message,
    severity,
    acknowledged: false,         // 👈 NEW
    ackBy: null,
    ackTime: null,
    cleared: false,          // 👈 NEW
    clearTime: null
  };

  alarms.push(alarm);
  lastAlarmCode = code;

  console.log(`🚨 [${severity}] ${code} - ${message}`);

  // ✅ SAFE: global.services exists by now
  const logService = global.services?.logService;
  if (logService) {
    logService.log({
      type: 'ALARM',
      severity,
      code,
      message,
      user: 'system',
      role: 'system'
    });
  }
}

function acknowledge(id, user) {
  const alarm = alarms.find(a => a.id === id);
  if (!alarm || alarm.acknowledged) return false;

  alarm.acknowledged = true;
  alarm.ackBy = user;
  alarm.ackTime = new Date().toISOString();

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user,
    role: 'operator',
    action: 'ACK_ALARM',
    code: alarm.code,
    message: 'Alarm acknowledged'
  });

  return true;
}

function clear(code) {
  const alarm = [...alarms].reverse().find(
    a => a.code === code && !a.cleared
  );

  if (!alarm) return false;

  alarm.cleared = true;
  alarm.clearTime = new Date().toISOString();
  lastAlarmCode = null;

  console.log(`✅ [CLEAR] ${code}`);

  global.services.logService.log({
    type: 'ALARM',
    severity: 'INFO',
    code,
    message: 'Alarm cleared (condition recovered)',
    user: 'system',
    role: 'system'
  });

  return true;
}


function getAll() {
  return alarms.slice(-100);
}

module.exports = { raise, clear, getAll , acknowledge };
