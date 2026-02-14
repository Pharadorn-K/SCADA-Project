// frontend/public/js/views/production.js
import { scadaStore } from '../store.js';
const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding'];

let unsubscribe = null;

export function productionOverviewMount(container) {
  const plantId = 'plant1';

  container.innerHTML = `
    <h1>🏭 Production Overview</h1>
    <section id="machine-grid" class="machine-grid"></section>
  `;

  const grid = container.querySelector('#machine-grid');
  const tsEl = container.querySelector('#plant-timestamp');

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
          <div class="machine-header">
            <div class="machine-name">
              <span class="dot ${m.status?.toLowerCase()}"></span>
              ${id.split('_')[1]}
            </div>

            <span class="status-badge ${m.status?.toLowerCase()}">
              ${m.status ?? '--'}
            </span>
          </div>


          <div class="machine-image">
            <img src="/images/${id}.png" alt="${id}" />
          </div>

          <div class="machine-meta">
            <div><i class="fa-brands fa-product-hunt" style="color: rgba(116, 192, 252, 1);"></i> ${m.context?.part_name ?? '--'}</div>          
            <div><i class="fa-solid fa-user" style="color: rgba(116, 192, 252, 1);"></i> ${m.context?.operator_id ?? '--'}</div>
          </div>

          <div class="machine-kpi-grid">
            <div class="kpi-box">
              <div class="kpi-label">
                <i class="fa-solid fa-clock"></i> Cycle Time
              </div>
              <div class="kpi-value cycle-value">
                ${m.tags?.cycle_time ?? '--'} s
              </div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">
                <i class="fa-solid fa-box-open"></i> Count
              </div>
              <div class="kpi-value">
                ${m.tags?.count_today ?? '--'} / ${m.context?.plan ?? '--'}
              </div>
            </div>
          </div>

          <div class="machine-footer">
            <span class="latest-time">
              ⏱ Latest: ${
                m.timestamp
                  ? new Date(m.timestamp).toLocaleTimeString() : '--'}
            </span>
          </div>
        `;

          deptGrid.appendChild(card);
        });

        grid.appendChild(section);
      });
    });

}

export function productionOverviewUnmount() {
  if (unsubscribe) unsubscribe();
}

export function productionMachineEfficiencyView() {
  return `
    <div class="card">
      <h2>MachineEfficiency</h2>
      <div class="card">
        <h3>📡 Live PLC Data</h3>
        <pre id="plc-data">No data...</pre>
      </div>
    </div>
  `;
}

export function productionProductionHistoryView() {
  return `
    <div class="card">
      <h2>Production History</h2>
    </div>
  `;
}

export function productionStaffManagementView() {
  return `
    <div class="card">
      <h2>Staff Management</h2>
    </div>
  `;
}
