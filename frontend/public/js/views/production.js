// frontend/public/js/views/production.js 
import { scadaStore } from '../store.js'; 
import { formatDuration } from '../utils.js';
// const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding']; 
const DEPT_ORDER = ['press', 'heat', 'lathe']; 

// --------------- GLOBALS functions --------------- //
const SHIFT_ORDER = ['A', 'B', 'C'];
const SHIFT_SCHEDULE = {A: { start: "06:00", end: "14:00" }, B: { start: "14:00", end: "22:00" },C: { start: "22:00", end: "06:00" }};
let shiftWindow = null;
let shiftTrendChart = null;

function calculateShiftSummary() {

    const machines = Object.values(scadaStore.state.machines);

    let totalRun = 0;
    let totalIdle = 0;
    let totalAlarm = 0;
    let totalOffline = 0;
    machines.forEach(m => {

        if (!m.shiftDurations) return;

        let run = m.shiftDurations.run_seconds || 0;
        let idle = m.shiftDurations.idle_seconds || 0;
        let alarm = m.shiftDurations.alarm_seconds || 0;
        let offline = m.shiftDurations.offline_seconds || 0;

        const now = Date.now();

        if (m.statusStartedAt) {

            const delta = Math.floor((now - m.statusStartedAt) / 1000);

            if (m.status === 'RUNNING') run += delta;
            if (m.status === 'IDLE') idle += delta;
            if (m.status === 'ALARM') alarm += delta;
            if (m.status === 'OFFLINE') offline += delta;
        }

        totalRun += run;
        totalIdle += idle;
        totalAlarm += alarm;
        totalOffline += offline;

    });

    const planned = totalRun + totalIdle + totalAlarm;
    const availability = planned ? (totalRun / planned) * 100 : 0;

    return {
        availability,
        totalRun,
        totalIdle,
        totalAlarm,
        totalOffline
    };
}
function kpiClass(v) {
    if (v >= 85) return 'kpi-good';
    if (v >= 60) return 'kpi-warning'; 
    return 'kpi-bad'; 
} 
function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0'); 
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0'); 
    const s = String(sec % 60).padStart(2, '0'); 
    return `${h}:${m}:${s}`; 
}

function formatShiftDate(dateStr) {
    const d = new Date(dateStr);

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short"
    });
}
function safeKey(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}
// ── NEW: single loader + renderer ─────────────────────────────────────────
async function loadAndRenderShiftPanel(container) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/shift-history?date=${today}`);
  const json = await res.json();
  if (!json.data?.length) return;

  const shifts = json.data;           // newest first
  updateKpiBar(container);
  renderTrendChart(container, shifts);
  renderShiftColumns(container, shifts);
}

// ── KPI bar (live from stateStore) ────────────────────────────────────────
function updateKpiBar(container) {
  const s = calculateShiftSummary();

  const avEl  = container.querySelector('#kpi-availability');
  const runEl = container.querySelector('#kpi-run');
  const idlEl = container.querySelector('#kpi-idle');
  const almEl = container.querySelector('#kpi-alarm');
  const offEl = container.querySelector('#kpi-off');

  if (!avEl) return;

  avEl.textContent  = `${s.availability.toFixed(1)}%`;
  avEl.className    = `kpi-val ${kpiClass(s.availability)}`;
  runEl.textContent = formatTime(s.totalRun);
  idlEl.textContent = formatTime(s.totalIdle);
  almEl.textContent = formatTime(s.totalAlarm);
  offEl.textContent = formatTime(s.totalOffline);
}

// ── Trend sparkline (Chart.js) ────────────────────────────────────────────
function renderTrendChart(container, shifts) {
  const ctx = container.querySelector('#trendChart')?.getContext('2d');
  if (!ctx) return;

  // plant availability = mean of dept availabilities per shift
  const entries = shifts.slice(0, 18).reverse().map(s => {
    const depts = s.departments;
    const avg = depts.length
      ? depts.reduce((a, d) => a + d.availability * 100, 0) / depts.length
      : 0;
    return { label: `${s.shift} ${formatShiftDate(s.date)}`, value: avg };
  });

  const labels = entries.map(e => e.label);
  const values = entries.map(e => +e.value.toFixed(1));

  if (!shiftTrendChart) {
    shiftTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { display: false },
          y: {
            min: 0, max: 100,
            display: true,
            ticks: { font: { size: 5 }, maxTicksLimit: 4,
                     callback: v => v + '%' },
            grid: { color: 'rgba(0,0,0,0.05)' }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  } else {
    shiftTrendChart.data.labels = labels;
    shiftTrendChart.data.datasets[0].data = values;
    shiftTrendChart.update('none');
  }
}

// ── Shift columns (4 newest shifts) ───────────────────────────────────────
function renderShiftColumns(container, shifts) {
  const grid = container.querySelector('#shift-col-grid');
  if (!grid) return;

  const display = shifts.slice(0, 4);  // newest first = index 0 is current

  // Build columns only once
  if (!grid.children.length) {
    grid.innerHTML = display.map((s, i) => {
    //   const key = `${s.date}_${s.shift}`;
      const key = `${safeKey(s.date)}_${s.shift}`;
      const isCurrent = i === 0;
      return `
        <div class="sc-col ${isCurrent ? 'sc-current' : ''}" data-key="${key}">
          <div class="sc-head">
            <span class="sc-shift">Shift ${s.shift}</span>
            <span class="sc-badge ${isCurrent ? 'sc-badge-now' : 'sc-badge-old'}">
              ${isCurrent ? 'NOW' : i === 1 ? '-1' : i === 2 ? '-2' : '-3'}
            </span>
          </div>
          <div class="sc-date" id="scdate_${key}">${formatShiftDate(s.date)}</div>
          ${DEPT_ORDER.map(dept => `
            <div class="sc-dept-row">
              <span class="sc-dname">${dept}</span>
              <div class="sc-bar-track">
                <div class="sc-bar-fill ${isCurrent ? 'sc-bar-current' : ''}"
                     id="scbar_${key}_${dept}" style="width:0%"></div>
              </div>
              <span class="sc-dpct" id="scpct_${key}_${dept}">--%</span>
            </div>
          `).join('')}
          <div class="sc-plant-avail" id="scavail_${key}">--%</div>
        </div>
      `;
    }).join('');
  }

  // Always update values
  display.forEach((s, i) => {
    // const key = `${s.date}_${s.shift}`;
    const key = `${safeKey(s.date)}_${s.shift}`;
    const isCurrent = i === 0;

    // per-dept bars
    let totalAvail = 0;
    s.departments.forEach(d => {
      const pct = (d.availability * 100);
      totalAvail += pct;
      const deptKey = d.department.toLowerCase();
      const barEl = container.querySelector(`#scbar_${key}_${deptKey}`);
      const pctEl = container.querySelector(`#scpct_${key}_${deptKey}`);
      if (barEl) barEl.style.width = `${pct.toFixed(0)}%`;
      if (pctEl) pctEl.textContent = `${pct.toFixed(0)}%`;
    });

    // plant-level availability for this shift
    const plantAvail = s.departments.length
      ? totalAvail / s.departments.length
      : 0;
    const avEl = container.querySelector(`#scavail_${key}`);
    if (avEl) {
      avEl.textContent = `${plantAvail.toFixed(1)}%`;
      avEl.className = `sc-plant-avail ${kpiClass(plantAvail)}`;
    }
  });
}
// ── ADD this helper ───────────────────────────────────────────────────────
function calcAvailability(m) {
  const d = m.shiftDurations;
  if (!d) return 0;
  const planned = (d.run_seconds || 0) + (d.idle_seconds || 0) + (d.alarm_seconds || 0);
  return planned > 0 ? (d.run_seconds / planned) * 100 : 0;
}
// frontend/public/js/views/production.js

// ── Standard cycle times (seconds) ───────────────────────────────────────
// Key = stateStore machine key (department_machine)
const STANDARD_MAP = {
  // Heat
  'heat_DKK1':     86.9,
  'heat_DKK2':     86.89,
  'heat_K3':       94.98,
  'heat_K4':       94.09,
  'heat_K5':       90,
  'heat_K6':       90,
  'heat_K7':       96.18,
  'heat_K8':       96.04,
  // Press
  'press_AIDA630T':   6.45,
  'press_M-20id-25':  6.3,
  // Lathe
  'lathe_Rotor TK1':  93.45,
  'lathe_Rotor TK4':  93.88,
};

// Inject standard_cycle_time into every machine in the store.
// Called once after the first snapshot arrives so machines exist.
function applyStandardMap() {
  const machines = scadaStore.state.machines;
  for (const [key, std] of Object.entries(STANDARD_MAP)) {
    if (machines[key]) {
      machines[key].standard_cycle_time = std;
    }
  }
}
// ---------------- Overview Page ---------------- // 
let unsubscribe = null; 
let summaryTimer = null;
let shiftTimer = null;
let initialized = false;
export function productionOverviewMount(container) {
    const plantId = 'plant1'; 
    const cardMap = new Map(); // machineId → DOM element 

    container.innerHTML = `
    <div class="h-pd-overview">
      <h1>Production Overview</h1>
    </div>

    <div class="summary-panel">
        <div class="sp-kpi-bar">
          <div class="sp-kpi-cell">
              <div class="sp-kpi-icon sp-icon-avail">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              </div>
              <div class="sp-kpi-text">
              <div class="sp-kpi-label">Availability today</div>
              <div class="kpi-val" id="kpi-availability">--%</div>
              </div>
          </div>
          <div class="sp-kpi-cell">
              <div class="sp-kpi-icon sp-icon-run">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <polygon points="5,3 13,8 5,13" fill="currentColor"/>
              </svg>
              </div>
              <div class="sp-kpi-text">
              <div class="sp-kpi-label">Run total</div>
              <div class="sp-kpi-val" id="kpi-run">--:--:--</div>
              </div>
          </div>
          <div class="sp-kpi-cell">
              <div class="sp-kpi-icon sp-icon-idle">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/>
                  <rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/>
              </svg>
              </div>
              <div class="sp-kpi-text">
              <div class="sp-kpi-label">Idle total</div>
              <div class="sp-kpi-val" id="kpi-idle">--:--:--</div>
              </div>
          </div>
          <div class="sp-kpi-cell">
              <div class="sp-kpi-icon sp-icon-alarm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2l6 11H2L8 2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
                  <line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  <circle cx="8" cy="12" r="0.7" fill="currentColor"/>
              </svg>
              </div>
              <div class="sp-kpi-text">
              <div class="sp-kpi-label">Alarm total</div>
              <div class="sp-kpi-val" id="kpi-alarm">--:--:--</div>
              </div>
          </div>
          <div class="sp-kpi-cell">
              <div class="sp-kpi-icon sp-icon-off">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5 5L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M11 5L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/>
              </svg>
              </div>
              <div class="sp-kpi-text">
              <div class="sp-kpi-label">Offline total</div>
              <div class="sp-kpi-val" id="kpi-off">--:--:--</div>
              </div>
          </div>
        </div>    
    </div>

    <div class="shift-panel">
        <div class="sp-bottom">
        <div class="sp-trend">
            <div class="sp-trend-label">Plant availability — last 18 shifts</div>
            <div class="sp-trend-chart">
            <canvas id="trendChart"></canvas>
            </div>
        </div>
        <div class="sp-cols" id="shift-col-grid"></div>
        </div>

    </div>

    <section id="machine-grid" class="machine-grid"></section>
    `;

    // replace the old loadTodayShiftHistory() + summaryTimer + shiftTimer calls with:
    loadAndRenderShiftPanel(container);

    summaryTimer = setInterval(() => {
    updateKpiBar(container);
    }, 1000);

    shiftTimer = setInterval(() => {
    loadAndRenderShiftPanel(container);
    }, 10000);

    const grid = container.querySelector('#machine-grid');
    unsubscribe = scadaStore.subscribe(state => {
        const machines = Object.entries(state.machines); 
        const groups = {}; 
        machines.forEach(([id, m]) => {
            const [dept] = id.split('_'); 
            if (!groups[dept]) groups[dept] = []; 
            groups[dept].push([id, m]); 
        }); 
        
        // 🔥 FIRST LOAD → build structure once 
        if (!initialized) {
            DEPT_ORDER.forEach(dept => {
                const list = groups[dept]; 
                if (!list) return;

                    const section = document.createElement('section'); 
                    section.className = 'department-section'; 
                    section.dataset.dept = dept; 
                
                    section.innerHTML = `
                        <h2 class="department-title">${dept.toUpperCase()}</h2> 
                        <div class="department-grid"></div> 
                        `; 
                        grid.appendChild(section); 
                    }); 
                    initialized = true; 
        };

        // 🔥 UPDATE / CREATE CARDS 
        machines.forEach(([id, m]) => { 
            let card = cardMap.get(id);
            if (!card) {
                // 🆕 create new card 
                card = createMachineCard(id, m); 
                cardMap.set(id, card); 
                
                const dept = id.split('_')[0]; 
                const section = grid.querySelector(`[data-dept="${dept}"]`); 
                section.querySelector('.department-grid').appendChild(card); 
            } else { 
                // 🔄 update existing card 
                updateMachineCard(card, id, m); 
            } 
        }); 
    });
    applyStandardMap();
    // ── REPLACE statusClass ───────────────────────────────────────────────────
    function statusClass(machine) {
    return machine.status?.toLowerCase() || 'offline';
    }
    // ── REPLACE createMachineCard ─────────────────────────────────────────────
    function createMachineCard(id, m) {
    const card = document.createElement('div');
    card.className = `mc mc-${statusClass(m)}`;

    card.innerHTML = `
        <div class="mc-head">
        <div class="mc-name-row">
            <span class="mc-dot"></span>
            <span class="mc-name">${id.split('_')[1]}</span>
        </div>
        <span class="mc-badge">${m.status ?? '--'}</span>
        </div>

        <div class="mc-body">
        <div class="mc-img-col">
            <img src="/images/${id}.png" alt="${id}"
                onerror="this.style.opacity='.12'" />
        </div>
        <div class="mc-info-col">
            <div class="mc-info-row">
            <span class="mc-il">Part</span>
            <span class="mc-iv mc-part"></span>
            </div>
            <div class="mc-info-row">
            <span class="mc-il">Operator</span>
            <span class="mc-iv mc-operator"></span>
            </div>
            <div class="mc-info-row">
            <span class="mc-il">Cycle time</span>
            <span class="mc-iv mc-cycle"></span>
            </div>
            <div class="mc-info-row">
            <span class="mc-il">Count</span>
            <span class="mc-iv mc-count"></span>
            </div>
            <div class="mc-info-row">
            <span class="mc-il">Availability</span>
            <span class="mc-iv mc-avail"></span>
            </div>
        </div>
        </div>

        <div class="mc-dur">
        <div class="mc-dur-row">
            <div class="mc-dur-cell">
            <div class="mc-dur-dot mc-dot-run"></div>
            <div class="mc-dur-time mc-dur-run-t"></div>
            <div class="mc-dur-label">Run</div>
            </div>
            <div class="mc-dur-cell">
            <div class="mc-dur-dot mc-dot-idle"></div>
            <div class="mc-dur-time mc-dur-idle-t"></div>
            <div class="mc-dur-label">Idle</div>
            </div>
            <div class="mc-dur-cell">
            <div class="mc-dur-dot mc-dot-alarm"></div>
            <div class="mc-dur-time mc-dur-alarm-t"></div>
            <div class="mc-dur-label">Alarm</div>
            </div>
            <div class="mc-dur-cell">
            <div class="mc-dur-dot mc-dot-offline"></div>
            <div class="mc-dur-time mc-dur-offline-t"></div>
            <div class="mc-dur-label">Offline</div>
            </div>
        </div>
        <div class="mc-composite-bar">
            <div class="mc-cb-run"></div>
            <div class="mc-cb-idle"></div>
            <div class="mc-cb-alarm"></div>
            <div class="mc-cb-offline"></div>
        </div>
        </div>

        <div class="mc-footer">
        <span class="mc-ts"></span>
        <span class="mc-shift"></span>
        </div>
    `;

    card.addEventListener('click', () => {
        const [dept, machine] = id.split('_');
        window.location.hash =
        `#production/machine_efficiency?dept=${dept}&machine=${machine}`;
    });

    updateMachineCard(card, id, m);
    return card;
    }

    // ── REPLACE updateMachineCard ─────────────────────────────────────────────
    function updateMachineCard(card, id, m) {
    const status = statusClass(m);

    // root class
    card.className = `mc mc-${status}`;

    // header
    card.querySelector('.mc-badge').textContent = m.status ?? '--';
    card.querySelector('.mc-badge').className = `mc-badge mc-badge-${status}`;
    card.querySelector('.mc-dot').className = `mc-dot mc-dot-status-${status}`;

    // info col
    card.querySelector('.mc-part').textContent     = m.context?.part_name  || '--';
    card.querySelector('.mc-operator').textContent = m.context?.operator_id || '--';
    card.querySelector('.mc-cycle').textContent    =
        m.tags?.cycle_time != null ? `${m.tags.cycle_time} s` : '-- s';
    card.querySelector('.mc-count').textContent    =
        `${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}`;

    const avail = calcAvailability(m);
    const availEl = card.querySelector('.mc-avail');
    availEl.textContent = `${avail.toFixed(1)}%`;
    availEl.style.color = avail >= 85 ? '#1D9E75' : avail >= 60 ? '#BA7517' : '#A32D2D';

    // duration times
    const d = m.shiftDurations || {};
    const run     = d.run_seconds     || 0;
    const idle    = d.idle_seconds    || 0;
    const alarm   = d.alarm_seconds   || 0;
    const offline = d.offline_seconds || 0;

    card.querySelector('.mc-dur-run-t').textContent =
        formatDuration(run,     m.status === 'RUNNING'  ? m.statusStartedAt : null);
    card.querySelector('.mc-dur-idle-t').textContent =
        formatDuration(idle,    m.status === 'IDLE'     ? m.statusStartedAt : null);
    card.querySelector('.mc-dur-alarm-t').textContent =
        formatDuration(alarm,   m.status === 'ALARM'    ? m.statusStartedAt : null);
    card.querySelector('.mc-dur-offline-t').textContent =
        formatDuration(offline, m.status === 'OFFLINE'  ? m.statusStartedAt : null);

    // composite bar proportions
    const total = run + idle + alarm + offline || 1;
    card.querySelector('.mc-cb-run').style.flex     = run;
    card.querySelector('.mc-cb-idle').style.flex    = idle;
    card.querySelector('.mc-cb-alarm').style.flex   = alarm;
    card.querySelector('.mc-cb-offline').style.flex = offline || 0.5; // keep visible when 0

    // footer
    card.querySelector('.mc-ts').textContent =
        m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '--';
    card.querySelector('.mc-shift').textContent =
        m.shift ? `Shift ${m.shift}` : '';
    }

} 
export function productionOverviewUnmount() {

    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    if (summaryTimer) {
        clearInterval(summaryTimer);
        summaryTimer = null;
    }

    if (shiftTimer) {
        clearInterval(shiftTimer);
        shiftTimer = null;
    }

    if (shiftTrendChart) {
        shiftTrendChart.destroy();
        shiftTrendChart = null;
    }

    initialized = false;
    shiftWindow = null;
}

// --------------- Machine Efficiency page --------------- //
let efficiencyUnsubscribe = null; 
let stopwatchInterval = null; 

export function productionMachineEfficiencyView() {
  return `
    <div class="h-pd-overview">
    <h1>Machine Efficiency</h1>
    </div>

    <div class="eff-layout">

      <div class="eff-sidebar">
        <div class="eff-select-group">
          <label class="eff-label">Department</label>
          <select id="dept-select">
            <option value="">Select department</option>
          </select>
        </div>
        <div class="eff-select-group">
          <label class="eff-label">Machine</label>
          <select id="machine-select" disabled>
            <option value="">Select machine</option>
          </select>
        </div>

        <div id="eff-machine-card" class="eff-machine-card" style="display:none">

          <div class="eff-card-head">
            <div class="eff-card-name-row">
              <span class="eff-dot"></span>
              <span class="eff-card-name"></span>
            </div>
            <span class="eff-card-badge"></span>
          </div>

          <div class="eff-card-img">
            <img class="eff-img" src="" alt="" onerror="this.style.opacity='.12'"/>
          </div>

          <div class="eff-info-grid">
            <span class="eff-il">Part</span>       <span class="eff-iv eff-part"></span>
            <span class="eff-il">Operator</span>   <span class="eff-iv eff-operator"></span>
            <span class="eff-il">Cycle time</span> <span class="eff-iv eff-cycle"></span>
            <span class="eff-il">Count / Plan</span><span class="eff-iv eff-count"></span>
          </div>

          <div class="eff-dur-block">
            <div class="eff-dur-row">
              <div class="eff-dur-cell">
                <div class="eff-dur-dot eff-dot-run"></div>
                <div class="eff-dur-time eff-t-run"></div>
                <div class="eff-dur-lbl">Run</div>
              </div>
              <div class="eff-dur-cell">
                <div class="eff-dur-dot eff-dot-idle"></div>
                <div class="eff-dur-time eff-t-idle"></div>
                <div class="eff-dur-lbl">Idle</div>
              </div>
              <div class="eff-dur-cell">
                <div class="eff-dur-dot eff-dot-alarm"></div>
                <div class="eff-dur-time eff-t-alarm"></div>
                <div class="eff-dur-lbl">Alarm</div>
              </div>
              <div class="eff-dur-cell">
                <div class="eff-dur-dot eff-dot-offline"></div>
                <div class="eff-dur-time eff-t-offline"></div>
                <div class="eff-dur-lbl">Offline</div>
              </div>
            </div>
            <div class="eff-composite-bar">
              <div class="eff-cb-run"></div>
              <div class="eff-cb-idle"></div>
              <div class="eff-cb-alarm"></div>
              <div class="eff-cb-offline"></div>
            </div>
          </div>

        </div>
      </div>

      <div class="eff-main">

        <div id="eff-oee-row" class="eff-oee-row" style="display:none">
          <div class="eff-oee-box">
            <div class="eff-oee-label">Availability</div>
            <div class="eff-oee-val" id="oee-avail">--%</div>
          </div>
          <div class="eff-oee-sep">×</div>
          <div class="eff-oee-box">
            <div class="eff-oee-label">Performance</div>
            <div class="eff-oee-val" id="oee-perf">--%</div>
          </div>
          <div class="eff-oee-sep">×</div>
          <div class="eff-oee-box">
            <div class="eff-oee-label">Quality</div>
            <div class="eff-oee-val" id="oee-qual">100%</div>
          </div>
          <div class="eff-oee-sep">=</div>
          <div class="eff-oee-box eff-oee-total">
            <div class="eff-oee-label">OEE</div>
            <div class="eff-oee-val" id="oee-total">--%</div>
          </div>
        </div>

        <div id="eff-chart-wrap" class="eff-chart-wrap" style="display:none">
          <div class="eff-chart-header">
            <span class="eff-chart-title">Cycle time history</span>
            <span class="eff-chart-sub" id="eff-std-label"></span>
          </div>
          <div class="eff-chart-container">
            <canvas id="cycleChart"></canvas>
          </div>
        </div>

        <div id="eff-empty" class="eff-empty">
          Select a department and machine to view efficiency data
        </div>

      </div>
    </div>
  `;
}
export function productionMachineEfficiencyMount(container) {
  applyStandardMap();
  const deptSelect    = container.querySelector('#dept-select');
  const machineSelect = container.querySelector('#machine-select');
  const machineCard   = container.querySelector('#eff-machine-card');
  const oeeRow        = container.querySelector('#eff-oee-row');
  const chartWrap     = container.querySelector('#eff-chart-wrap');
  const emptyMsg      = container.querySelector('#eff-empty');

  let selectedId    = null;
  let cycleChart    = null;
  let deepLinkDone  = false;

  // ── helpers ──────────────────────────────────────────────────────────────

  function getStandardCycleTime(m) {
    // stored on machine object if admin has set it, otherwise null
    return m?.standard_cycle_time ?? null;
  }

  function calcAvailabilityPct(m) {
    const d = m?.shiftDurations;
    if (!d) return 0;
    const planned = (d.run_seconds || 0) + (d.idle_seconds || 0) + (d.alarm_seconds || 0);
    return planned > 0 ? (d.run_seconds / planned) * 100 : 0;
  }

  function calcPerformancePct(m) {
    const std = getStandardCycleTime(m);
    if (!std) return null;
    const runTime  = m?.shiftDurations?.run_seconds || 0;
    const count    = m?.tags?.count_shift || 0;
    if (!runTime || !count) return 0;
    // performance = (std * count) / runTime  — capped at 100%
    return Math.min((std * count) / runTime * 100, 100);
  }

  function calcOEE(avail, perf) {
    if (perf === null) return null;
    // quality assumed 100% (no reject data)
    return (avail / 100) * (perf / 100) * 100;
  }

  function oeeColor(v) {
    if (v === null || v === undefined) return '#aaa';
    if (v >= 85) return '#1D9E75';
    if (v >= 60) return '#BA7517';
    return '#A32D2D';
  }

  function movingAverage(arr, w = 5) {
    return arr.map((_, i) => {
      const slice = arr.slice(Math.max(0, i - w + 1), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  }

  // ── sidebar card update ───────────────────────────────────────────────────

  function updateSidebarCard(id, m) {
    if (!m) return;
    const status = m.status?.toLowerCase() || 'offline';

    machineCard.style.display = '';
    machineCard.className = `eff-machine-card eff-mc-${status}`;

    container.querySelector('.eff-card-name').textContent = id.split('_')[1];
    const badge = container.querySelector('.eff-card-badge');
    badge.textContent  = m.status ?? '--';
    badge.className    = `eff-card-badge eff-badge-${status}`;
    container.querySelector('.eff-dot').className = `eff-dot eff-dot-${status}`;

    container.querySelector('.eff-img').src = `/images/${id}.png`;
    container.querySelector('.eff-img').alt = id;

    container.querySelector('.eff-part').textContent     = m.context?.part_name   || '--';
    container.querySelector('.eff-operator').textContent = m.context?.operator_id || '--';
    container.querySelector('.eff-cycle').textContent    =
      m.tags?.cycle_time != null ? `${m.tags.cycle_time} s` : '-- s';
    container.querySelector('.eff-count').textContent    =
      `${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}`;

    // durations
    const d       = m.shiftDurations || {};
    const run     = d.run_seconds     || 0;
    const idle    = d.idle_seconds    || 0;
    const alarm   = d.alarm_seconds   || 0;
    const offline = d.offline_seconds || 0;

    container.querySelector('.eff-t-run').textContent =
      formatDuration(run,     status === 'running'  ? m.statusStartedAt : null);
    container.querySelector('.eff-t-idle').textContent =
      formatDuration(idle,    status === 'idle'     ? m.statusStartedAt : null);
    container.querySelector('.eff-t-alarm').textContent =
      formatDuration(alarm,   status === 'alarm'    ? m.statusStartedAt : null);
    container.querySelector('.eff-t-offline').textContent =
      formatDuration(offline, status === 'offline'  ? m.statusStartedAt : null);

    const total = run + idle + alarm + offline || 1;
    container.querySelector('.eff-cb-run').style.flex     = run;
    container.querySelector('.eff-cb-idle').style.flex    = idle;
    container.querySelector('.eff-cb-alarm').style.flex   = alarm;
    container.querySelector('.eff-cb-offline').style.flex = offline || 0.5;
  }

  // ── OEE row update ────────────────────────────────────────────────────────

  function updateOeeRow(m) {
    const avail = calcAvailabilityPct(m);
    const perf  = calcPerformancePct(m);
    const oee   = calcOEE(avail, perf);

    oeeRow.style.display = '';

    const availEl = container.querySelector('#oee-avail');
    availEl.textContent = `${avail.toFixed(1)}%`;
    availEl.style.color = oeeColor(avail);

    const perfEl = container.querySelector('#oee-perf');
    if (perf === null) {
      perfEl.textContent = 'N/A';
      perfEl.style.color = '#aaa';
    } else {
      perfEl.textContent = `${perf.toFixed(1)}%`;
      perfEl.style.color = oeeColor(perf);
    }

    const oeeEl = container.querySelector('#oee-total');
    if (oee === null) {
      oeeEl.textContent = 'N/A';
      oeeEl.style.color = '#aaa';
    } else {
      oeeEl.textContent = `${oee.toFixed(1)}%`;
      oeeEl.style.color = oeeColor(oee);
    }
  }

  // ── cycle chart ───────────────────────────────────────────────────────────

  function updateCycleChart(m) {
    const history = m?.cycleHistory ?? [];
    const std     = getStandardCycleTime(m);
    // console.log("STD:", std);
    // console.log("HISTORY:", history);
    chartWrap.style.display = '';
    emptyMsg.style.display  = 'none';

    const stdLabel = container.querySelector('#eff-std-label');
    stdLabel.textContent = std ? `Standard: ${std} s` : 'No standard set';

    const labels = history.map(p => new Date(p.t).toLocaleTimeString());
    const values = history.map(p => p.v);
    const ma     = movingAverage(values, 5);
    const maxVal = values.length ? Math.max(...values) : (std ? std * 2 : 100);
    // const yMax   = std ? Math.max(maxVal * 1.1, std * 1.8) : maxVal * 1.2 || 100;
    const rawMax = std ? Math.max(maxVal * 1.1, std * 1.8) : maxVal * 1.2 || 100;
    const yMax = Math.ceil(rawMax * 10) / 10;
    
    // zone boundaries (only meaningful if std is set)
    const greenMax  = std ? std * 1.0   : null;  // on or under standard
    const yellowMax = std ? std * 1.341 : null;  // warning zone
    const redMax    = std ? yMax        : null;  // above yellow = red

    const annotations = std ? {
      greenZone: {
        type: 'box', yMin: 0, yMax: greenMax,
        backgroundColor: 'rgba(29,158,117,0.08)',
        borderColor: 'rgba(29,158,117,0.3)', borderWidth: 1
      },
      yellowZone: {
        type: 'box', yMin: greenMax, yMax: yellowMax,
        backgroundColor: 'rgba(186,117,23,0.08)',
        borderColor: 'rgba(186,117,23,0.3)', borderWidth: 1
      },
      redZone: {
        type: 'box', yMin: yellowMax, yMax: redMax,
        backgroundColor: 'rgba(163,45,45,0.06)',
        borderColor: 'rgba(163,45,45,0.25)', borderWidth: 1
      },
      stdLine: {
        type: 'line', yMin: std, yMax: std,
        borderColor: '#1D9E75', borderWidth: 1.5,
        borderDash: [4, 4],
        label: {
          display: true, content: `Std ${std}s`,
          position: 'end', color: '#1D9E75',
          font: { size: 10 }
        }
      }
    } : {};

    if (!cycleChart) {
      const ctx = container.querySelector('#cycleChart');
      cycleChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Cycle time (s)',
              data: values,
              borderColor: '#378ADD',
              backgroundColor: 'rgba(55,138,221,0.08)',
              fill: true,
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
              order: 2
            },
            {
              label: 'Moving avg (5)',
              data: ma,
              borderColor: '#BA7517',
              borderDash: [5, 4],
              fill: false,
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.4,
              order: 1
            }
          ]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              ticks: { font: { size: 10 }, maxTicksLimit: 8,
                       maxRotation: 0 },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              max: yMax,
              ticks: { font: { size: 10 },
                       callback: v => `${v}s` },
              grid: { color: 'rgba(0,0,0,0.05)' }
            }
          },
          plugins: {
            legend: {
              display: true,
              labels: { font: { size: 11 }, boxWidth: 14 }
            },
            annotation: { annotations }
          }
        }
      });
    } else {
      // update data in-place — never recreate the canvas
      cycleChart.data.labels                  = labels;
      cycleChart.data.datasets[0].data        = values;
      cycleChart.data.datasets[1].data        = ma;
      cycleChart.options.scales.y.max         = yMax;
      if (cycleChart.options.plugins?.annotation) {
        cycleChart.options.plugins.annotation.annotations = annotations;
      }
      cycleChart.update('none');
    }
  }

  // ── main render ───────────────────────────────────────────────────────────

  function renderSelected(id) {
    const m = scadaStore.state.machines[id];
    // console.log('Selected machine:', id);
    // console.log('Machine data:', m);
    // console.log('Cycle history:', m?.cycleHistory);
    if (!m) return;
    updateSidebarCard(id, m);
    updateOeeRow(m);
    updateCycleChart(m);
  }

  // ── dropdowns ─────────────────────────────────────────────────────────────

  function buildDepts(state) {
    if (deptSelect.options.length > 1) return;
    const depts = [...new Set(
      Object.keys(state.machines).map(id => id.split('_')[0])
    )];
    depts.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d.toUpperCase();
      deptSelect.appendChild(o);
    });
  }

  function buildMachines(state, dept) {
    machineSelect.innerHTML = '<option value="">Select machine</option>';
    machineSelect.disabled  = false;
    Object.keys(state.machines)
      .filter(id => id.startsWith(dept + '_'))
      .forEach(id => {
        const o = document.createElement('option');
        o.value = id.split('_')[1];
        o.textContent = id.split('_')[1];
        machineSelect.appendChild(o);
      });
  }

  deptSelect.addEventListener('change', e => {
    const dept = e.target.value;
    if (!dept) return;
    buildMachines(scadaStore.state, dept);
    selectedId = null;
    machineCard.style.display = 'none';
    oeeRow.style.display      = 'none';
    chartWrap.style.display   = 'none';
    emptyMsg.style.display    = '';
  });

  machineSelect.addEventListener('change', e => {
    const machine = e.target.value;
    const dept    = deptSelect.value;
    if (!machine || !dept) return;
    selectedId = `${dept}_${machine}`;
    renderSelected(selectedId);
  });

  // ── deep link ─────────────────────────────────────────────────────────────

  function applyDeepLink(state) {
    const hash   = location.hash;
    const qi     = hash.indexOf('?');
    if (qi === -1) return false;
    const params = new URLSearchParams(hash.substring(qi + 1));
    const dept   = params.get('dept');
    const machine = params.get('machine');
    if (!dept || !machine) return false;
    if (!state.machines[`${dept}_${machine}`]) return false;

    deptSelect.value = dept;
    buildMachines(state, dept);
    machineSelect.value = machine;
    selectedId = `${dept}_${machine}`;
    renderSelected(selectedId);
    return true;
  }

  // ── store subscription ────────────────────────────────────────────────────

  efficiencyUnsubscribe = scadaStore.subscribe(state => {
    buildDepts(state);

    if (!deepLinkDone) {
      deepLinkDone = applyDeepLink(state);
    }

    if (selectedId) renderSelected(selectedId);
  });
}
export function productionMachineEfficiencyUnmount() {
    if (efficiencyUnsubscribe) {
        efficiencyUnsubscribe(); 
        efficiencyUnsubscribe = null; 
    } 
    if (stopwatchInterval) { 
        clearInterval(stopwatchInterval); 
        stopwatchInterval = null; 
    } 
}

// ---------------- HISTORY page --------------- //
export function productionProductionHistoryView() {
  return `
    <div class="card">
      <h2>Production History</h2>
      <div class="card">
        <h3>📡 Live PLC Data</h3>
        <pre id="plc-data">No data...</pre>
      </div>
    </div>
  `;
}

export async function productionProductionHistoryMount() {
  const dataEl = document.getElementById('plc-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });
}

export function productionProductionHistoryUnmount() {
  if (unsubscribe) unsubscribe();
}
// ---------------- STAFF MANAGEMENT page --------------- //
export function productionStaffManagementView() {
  return `
      <h1>👨‍👨‍👦‍ Staff Management</h1>
      <div class="card">
        <p>Waiting for development</p>
      </div>
  `;
}
