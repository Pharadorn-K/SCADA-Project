// frontend/public/js/storeSelectors.js
export function selectAllMachines(state) {
  return Object.entries(state.machines);
}

export function selectByPlant(state, plantId) {
  return Object.entries(state.machines)
    .filter(([id]) => id.startsWith(plantId));
}

export function selectAlarms(state) {
  return Object.entries(state.machines)
    .flatMap(([id, m]) =>
      m.alarms.map(code => ({
        machineId: id,
        code
      }))
    );
}

export function selectOverview(state) {
  return {
    total: Object.keys(state.machines).length,
    running: Object.values(state.machines).filter(m => m.status === 'RUNNING').length,
    fault: Object.values(state.machines).filter(m => m.alarms.length).length
  };
}

export function selectPressMachines(state) {
  return Object.entries(state.machines)
    .filter(([id]) => id.toLowerCase().includes('press'));
}
