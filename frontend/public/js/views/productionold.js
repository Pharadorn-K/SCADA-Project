// frontend/public/js/views/production.js
import { scadaStore } from '../store.js';
// import Chart from 'chart.js/auto';
const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding'];

let unsubscribe = null;

export function productionOverviewMount(container) {
  const plantId = 'plant1';

  container.innerHTML = `
    <h1>🏭 Production Overview</h1>
    <section id="machine-grid" class="machine-grid"></section>
  `;

  const grid = container.querySelector('#machine-grid');
  // const tsEl = container.querySelector('#plant-timestamp');

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
          card.addEventListener('click', () => {
            const [dept, machine] = id.split('_');

            window.location.hash = `#production/machine_efficiency?dept=${dept}&machine=${machine}`;
          });
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
                  ${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}
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


let efficiencyUnsubscribe = null;
  
export function productionMachineEfficiencyView() {
  return `
    <h1>⚙️ Machine Efficiency</h1>

    <div class="filter-bar">
      <select id="dept-select">
        <option value="">Select Department</option>
      </select>

      <select id="machine-select" disabled>
        <option value="">Select Machine</option>
      </select>
    </div>

    <section id="selected-machine-card">
    </section>
    <section id="chart-container">
      <canvas id="cycleChart"></canvas>
    </section>
  `;
}
export function productionMachineEfficiencyMount(container) {
  const deptSelect = container.querySelector('#dept-select');
  const machineSelect = container.querySelector('#machine-select');
  const cardContainer = container.querySelector('#selected-machine-card');

  let selectedId = null;   // 🔥 track current machine
  let chart = null;

  function movingAverage(arr, window = 5) {
    const result = [];

    for (let i = 0; i < arr.length; i++) {

      const size = Math.min(window, i + 1);
      const slice = arr.slice(i - size + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / size;

      result.push(avg);
    }

    return result;
  }


  function renderMachineCard(id, m) {
    if (!m) return;

    cardContainer.innerHTML = `
      <div class="machine-card large ${m.status?.toLowerCase()}">
        <h2>${id.split('_')[1]}</h2>
        <p>Status: ${m.status}</p>
        <p>Cycle Time: ${m.tags?.cycle_time ?? '--'} s</p>
      </div>
    `;

    const history = m.cycleHistory ?? [];
    const labels = history.map(p =>
      new Date(p.t).toLocaleTimeString()
    );

    const values = history.map(p => p.v);
    const ma = movingAverage(values, 5);

    const targetValue = m.context?.standard_cycle_time ?? null;
    const targetLine = targetValue
      ? Array(values.length).fill(targetValue)
      : [];

    const ctx = document.getElementById('cycleChart');
    const maxValue = values.length ? Math.max(...values) : 0;

    // 🔥 If machine changed → destroy chart
    if (chart && chart.__machineId !== id) {
      chart.destroy();
      chart = null;
    }

    if (!chart) {
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Cycle Time (s)',
              data: values,
              borderWidth: 2,
              tension: 0.2
            },
            {
              label: 'MA',
              data: ma,
              borderWidth: 2,
              borderDash: [6,4],
              tension: 0.2
            },
            targetValue && {
              label: 'Target',
              data: targetLine,
              borderWidth: 2,
              borderDash: [4,4],
              pointRadius: 0
            }
          ].filter(Boolean)
        },

        options: {
          responsive: true,
          animation: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            annotation: {
              annotations: {
                greenZone: {
                  type: 'box',
                  yMin: 0,
                  yMax: targetValue * 1.341,
                  backgroundColor: 'rgba(0,255,0,0.1)',
                  borderColor: 'rgba(0,255,0,0.5)'
                },
                yellowZone: {
                  type: 'box',
                  yMin: targetValue * 1.341,
                  yMax: targetValue * 1.477,
                  backgroundColor: 'rgba(255,255,0,0.15)',
                  borderColor: 'rgba(255,255,0,0.5)'
                },
                redZone: {
                  type: 'box',
                  yMin: targetValue * 1.477,
                  yMax: round(targetValue * 1.477 + Math.max(...values) * 1.1),
                  backgroundColor: 'rgba(255,0,0,0.08)',
                  borderColor: 'rgba(255,0,0,0.5)'
                }
              }
            }
          }
        }

      });

      chart.__machineId = id; // 🔥 track which machine chart belongs to
    }
    else {
      // 🔥 FULL UPDATE
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[1].data = ma;

      if (targetValue) {
        if (!chart.data.datasets[2]) {
          chart.data.datasets.push({
            label: 'Target',
            data: targetLine,
            borderWidth: 2,
            borderDash: [4,4],
            pointRadius: 0
          });
        } else {
          chart.data.datasets[2].data = targetLine;
        }
      }
      // 🔥 Update dynamic red zone
      if (targetValue && chart.options.plugins?.annotation) {
        const maxValue = Math.max(...values, targetValue);

        chart.options.plugins.annotation.annotations.greenZone.yMax =
          targetValue * 1.341;

        chart.options.plugins.annotation.annotations.yellowZone.yMin =
          targetValue * 1.341;

        chart.options.plugins.annotation.annotations.yellowZone.yMax =
          targetValue * 1.477;

        chart.options.plugins.annotation.annotations.redZone.yMin =
          targetValue * 1.477;

        chart.options.plugins.annotation.annotations.redZone.yMax =
          Math.max(maxValue * 1.1, targetValue * 1.6);
      }

      chart.update('none');
    }
  }

  function buildDepartments(state) {
    const departments = [...new Set(
      Object.keys(state.machines).map(id => id.split('_')[0])
    )];

    deptSelect.innerHTML =
      `<option value="">Select Department</option>` +
      departments.map(d =>
        `<option value="${d}">${d.toUpperCase()}</option>`
      ).join('');
  }

  function updateMachines(state, dept) {
    machineSelect.innerHTML = `<option value="">Select Machine</option>`;
    machineSelect.disabled = false;

    Object.entries(state.machines)
      .filter(([id]) => id.startsWith(dept + '_'))
      .forEach(([id]) => {
        const machine = id.split('_')[1];
        machineSelect.innerHTML +=
          `<option value="${machine}">${machine}</option>`;
      });
  }

  // 🔥 Subscribe for LIVE updates
  efficiencyUnsubscribe = scadaStore.subscribe(state => {
    if (!selectedId) return;

    const m = state.machines[selectedId];
    renderMachineCard(selectedId, m);
  });

  // Build initial dropdowns
  buildDepartments(scadaStore.state);

  deptSelect.addEventListener('change', e => {
    const dept = e.target.value;
    if (!dept) return;

    updateMachines(scadaStore.state, dept);
  });

  machineSelect.addEventListener('change', e => {
    const machine = e.target.value;
    const dept = deptSelect.value;

    selectedId = `${dept}_${machine}`;

    const m = scadaStore.state.machines[selectedId];
    renderMachineCard(selectedId, m);
  });

  // 🔥 Handle deep link
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const deptParam = params.get('dept');
  const machineParam = params.get('machine');

  if (deptParam) {
    deptSelect.value = deptParam;
    updateMachines(scadaStore.state, deptParam);

    if (machineParam) {
      machineSelect.value = machineParam;
      selectedId = `${deptParam}_${machineParam}`;
      const m = scadaStore.state.machines[selectedId];
      renderMachineCard(selectedId, m);
    }
  }
}
export function productionMachineEfficiencyUnmount() {
  if (efficiencyUnsubscribe) {
    efficiencyUnsubscribe();
    efficiencyUnsubscribe = null;
  }
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
