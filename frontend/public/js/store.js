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
      statusStartedAt: Date.now(),
      shiftDurations: { run_seconds: 0, idle_seconds: 0, alarm_seconds: 0, offline_seconds: 0 },
      tags: {},
      context: {},
      alarms: []
    };

    const newStatus = deriveStatus(payload.department, payload.metrics);

    // Reset statusStartedAt only when status actually changes
    const statusStartedAt = (newStatus !== prev.status)
      ? Date.now()
      : (prev.statusStartedAt ?? Date.now());

    this.state.machines[key] = {
      ...prev,
      department: payload.department,
      machineType: payload.machine_type,
      status:         newStatus,
      statusStartedAt,
      // Preserve shiftDurations — only the server snapshot and localTimer update these
      shiftDurations: prev.shiftDurations ?? { run_seconds: 0, idle_seconds: 0, alarm_seconds: 0, offline_seconds: 0 },
      lastUpdate: Date.now(),
      timestamp: payload.timestamp,

      context: {
        ...prev.context,
        ...(payload.context || {})
      },

      tags: {
        ...prev.tags,
        ...Object.fromEntries(
          Object.entries(payload.metrics ?? {})
            .filter(([_, v]) => v !== undefined && v !== null)
        )
      },
      
      cycleHistory: payload.cycleHistory ?? prev.cycleHistory ?? [],

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

