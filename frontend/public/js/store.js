// frontend/public/js/store.js

function deriveStatus(department, metrics = {}) {
  if (metrics.offline === 1) return 'OFFLINE';

  const noSignal =
    !metrics.run &&
    !metrics.idle &&
    !metrics.alarm &&
    !metrics.setting &&
    !metrics.heat;

  if (noSignal) return 'OFFLINE';

  if (metrics.alarm === 1) return 'ALARM';

  if (department?.toLowerCase() === 'heat') {
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

  if (metrics.run === 1) return 'RUNNING';
  if (metrics.idle === 1) return 'IDLE';

  return 'STOP';
}


export const scadaStore = {
  state: {
    timestamp: null,
    machines: {}
  },

  ws: null,
  listeners: new Set(),


  // 🔐 Only entry point for WS data
  setSnapshot(snapshot) {
    this.state.timestamp = snapshot.timestamp ?? this.state.timestamp;
    this.state.machines = snapshot.machines ?? this.state.machines;
    this.notify();
  },

  applyUpdate({ machineId, changes }) {
    if (!this.state.machines[machineId]) return;

    const m = this.state.machines[machineId];

    if (changes.status) m.status = changes.status;
    if (changes.tags) Object.assign(m.tags, changes.tags);
    if (changes.alarms) m.alarms = changes.alarms;

    this.state.timestamp = Date.now();
    this.notify();
  },

  applyPlcClean(payload) {
    const key = `${payload.department.toLowerCase()}_${payload.machine}`;

    const prev = this.state.machines[key] || {
      department: payload.department,
      machineType: payload.machine_type,
      status: 'STOP',
      tags: {},
      context: {},
      alarms: []
    };

    this.state.machines[key] = {
      ...prev,

      // always update these
      department: payload.department,
      machineType: payload.machine_type,
      // status: deriveStatus(payload.metrics),
      status: deriveStatus(payload.department, payload.metrics),
      lastUpdate: Date.now(),
      // ⏱ machine-level timestamp (PLC time)
      timestamp: payload.timestamp,

      // 🧠 operator / part / plan
      context: {
        ...prev.context,
        ...(payload.context || {})
      },
      // 🔑 merge tags, don’t reset
      tags: {
        ...prev.tags,
        ...(payload.metrics.cycle_time !== undefined && {
          cycle_time: payload.metrics.cycle_time
        }),
        ...(payload.metrics.count_today !== undefined && {
          count_today: payload.metrics.count_today
        }),
        ...(payload.context?.plan !== undefined && {
          plan: payload.context.plan
        })
      },

      // alarms are status-driven → safe to replace
      alarms: payload.metrics.alarm
        ? [payload.metrics.alarm_code]
        : []

    };

    this.notify();
  },

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  },

  subscribe(fn) {
    this.listeners.add(fn);

    // immediate sync
    fn(this.state);

    return () => this.listeners.delete(fn);
  }
};

// // ⏱ Watchdog: detect stale machines
// const OFFLINE_TIMEOUT = 60000; // 10 seconds

// setInterval(() => {
//   const now = Date.now();
//   let changed = false;

//   Object.values(scadaStore.state.machines).forEach(machine => {
//     if (!machine.lastUpdate) return;

//     const diff = now - machine.lastUpdate;

//     if (diff > OFFLINE_TIMEOUT && machine.status !== 'OFFLINE') {
//       machine.status = 'OFFLINE';
//       changed = true;
//     }
//   });

//   if (changed) {
//     scadaStore.notify();
//   }
// }, 10000);
