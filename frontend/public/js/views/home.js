// frontend/public/js/views/home.js
import { scadaStore } from '../store.js';
const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding'];

let unsubscribe = null;

export function homeMount(container) {
  const plantId = 'plant1';

  container.innerHTML = `
    <h1>🏭 SCADA Dashboard </h1>
    <section class="plant-header">
      <h2>Plant - Overview</h2>
      <span id="plant-timestamp"></span>
    </section>

    <section id="machine-grid" class="machine-grid"></section>
  `;

  const grid = container.querySelector('#machine-grid');
  const tsEl = container.querySelector('#plant-timestamp');

  // function statusClass(machine) {
  //   if (machine.alarms?.length) return 'alarm';
  //   return machine.status?.toLowerCase() || 'idle';
  // }
  function statusClass(machine) {
    if (machine.status === 'OFFLINE') return 'offline';
    if (machine.alarms?.length) return 'alarm';
    return machine.status?.toLowerCase() || 'idle';
  }

    unsubscribe = scadaStore.subscribe(state => {
      const machines = Object.entries(state.machines);

      grid.innerHTML = '';

      const groups = {};

      machines.forEach(([id, m]) => {
        const [dept] = id.split('_');
        if (!groups[dept]) groups[dept] = [];
        groups[dept].push([id, m]);
      });

      DEPT_ORDER.forEach(dept => {
        const list = groups[dept];
        if (!list) return;

        const section = document.createElement('section');
        section.className = 'department-section';

        section.innerHTML = `
          <h2 class="department-title">${dept.toUpperCase()}</h2>
          <div class="department-grid"></div>
        `;

        const deptGrid = section.querySelector('.department-grid');

        list.forEach(([id, m]) => {
          const card = document.createElement('div');
          card.className = `machine-card ${statusClass(m)}`;

        card.innerHTML = `
          <div class="machine-image">
            <img src="/images/${id}.png" alt="${id}" />
          </div>

          <div class="machine-title">
            ${id.split('_')[1]}
          </div>

          <div class="machine-status">
            Status: ${m.status ?? '--'}
          </div>

          <div class="machine-tags">
            <div>Cycle: ${m.tags?.cycle_time ?? '--'} s</div>
            <div>Count today: ${m.tags?.count_today ?? '--'}</div>
          </div>

          <div class="machine-meta">
            <div>Operator: ${m.context?.operator_id ?? '--'}</div>
            <div>Part: ${m.context?.part_name ?? '--'}</div>
            <div>
              Last Updated:
              ${m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString()
                : '--'}
            </div>
          </div>
        `;

          deptGrid.appendChild(card);
        });

        grid.appendChild(section);
      });

      tsEl.textContent = state.timestamp
        ? new Date(state.timestamp).toLocaleTimeString()
        : '';
    });

}

export function homeUnmount() {
  if (unsubscribe) unsubscribe();
}
