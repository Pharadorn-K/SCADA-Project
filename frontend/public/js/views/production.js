
// frontend/public/js/views/production.js 
import { scadaStore } from '../store.js'; 
import { formatDuration } from '../utils.js';
const DEPT_ORDER = ['press', 'heat', 'lathe']; 

// --------------- GLOBALS functions --------------- //
const SHIFT_ORDER = ['A', 'B', 'C'];
const SHIFT_SCHEDULE = {A: { start: "06:00", end: "14:00" }, B: { start: "14:00", end: "22:00" },C: { start: "22:00", end: "06:00" }};
let shiftWindow = null;
let shiftTrendChart = null;

function calculateShiftSummary() {
    const machines = Object.values(scadaStore.state.machines);
    let totalRun = 0, totalIdle = 0, totalAlarm = 0, totalOffline = 0;
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
        totalRun += run; totalIdle += idle; totalAlarm += alarm; totalOffline += offline;
    });
    const planned = totalRun + totalIdle + totalAlarm + totalOffline;
    const availability = planned ? (totalRun / planned) * 100 : 0;
    return { availability, totalRun, totalIdle, totalAlarm, totalOffline };
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
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function safeKey(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function loadAndRenderShiftPanel(container) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/shift-history?date=${today}`);
  const json = await res.json();
  if (!json.data?.length) return;
  const shifts = json.data;
  updateKpiBar(container);
  renderTrendChart(container, shifts);
  renderShiftColumns(container, shifts);
}

let currentWindow = 'shift';
let windowData    = null;
let windowFetchTimer = null;
let currentProductionContainer = null;

async function fetchAndCacheWindow(win) {
  const res  = await fetch(`/api/plant-summary?window=${win}`, { credentials: 'same-origin' });
  windowData = await res.json();
}

function updateKpiBar(container) {
  let run, idle, alarm, offline, avail;
  if (currentWindow === 'shift') {
    const s = calculateShiftSummary();
    run = s.totalRun; idle = s.totalIdle; alarm = s.totalAlarm; offline = s.totalOffline;
    avail = s.availability;
  } else {
    if (!windowData) return;
    run = windowData.run; idle = windowData.idle; alarm = windowData.alarm; offline = windowData.offline;
    const machines = Object.values(scadaStore.state.machines);
    for (const m of machines) {
      if (!m.statusStartedAt) continue;
      const live = Math.floor((Date.now() - m.statusStartedAt) / 1000);
      if (m.status === 'RUNNING') run     += live;
      if (m.status === 'IDLE')    idle    += live;
      if (m.status === 'ALARM')   alarm   += live;
      if (m.status === 'OFFLINE') offline += live;
    }
    const planned = run + idle + alarm + offline;
    avail = planned > 0 ? (run / planned) * 100 : 0;
  }
  const avEl  = container.querySelector('#kpi-availability');
  const runEl = container.querySelector('#kpi-run');
  const idlEl = container.querySelector('#kpi-idle');
  const almEl = container.querySelector('#kpi-alarm');
  const offEl = container.querySelector('#kpi-off');
  if (!avEl) return;
  avEl.textContent  = `${avail.toFixed(1)}%`;
  avEl.className    = `kpi-val ${kpiClass(avail)}`;
  runEl.textContent = formatTime(run);
  idlEl.textContent = formatTime(idle);
  almEl.textContent = formatTime(alarm);
  offEl.textContent = formatTime(offline);
  const labels = { shift: 'Availability (shift)', '8': 'Availability (8h)', '24': 'Availability (24h)' };
  container.querySelector('.sp-kpi-cell .sp-kpi-label').textContent = labels[currentWindow] ?? 'Availability';
}

function renderTrendChart(container, shifts) {
  const ctx = container.querySelector('#trendChart')?.getContext('2d');
  if (!ctx) return;
  const entries = shifts.slice(0, 18).reverse().map(s => {
    const depts = s.departments;
    const avg = depts.length ? depts.reduce((a, d) => a + d.availability * 100, 0) / depts.length : 0;
    return { label: `${s.shift} ${formatShiftDate(s.date)}`, value: avg };
  });
  const labels = entries.map(e => e.label);
  const values = entries.map(e => +e.value.toFixed(1));
  if (!shiftTrendChart) {
    shiftTrendChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderWidth: 2, tension: 0.4, fill: false, pointRadius: 3, pointHoverRadius: 5 }] },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        scales: {
          x: { display: false },
          y: { min: 0, max: 100, display: true, ticks: { font: { size: 5 }, maxTicksLimit: 4, callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } }
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

function renderShiftColumns(container, shifts) {
  const grid = container.querySelector('#shift-col-grid');
  if (!grid) return;
  const display = shifts.slice(0, 4);
  if (!grid.children.length) {
    grid.innerHTML = display.map((s, i) => {
      const key = `${safeKey(s.date)}_${s.shift}`;
      const isCurrent = i === 0;
      return `
        <div class="sc-col ${isCurrent ? 'sc-current' : ''}" data-key="${key}">
          <div class="sc-head">
            <span class="sc-shift">Shift ${s.shift}</span>
            <span class="sc-badge ${isCurrent ? 'sc-badge-now' : 'sc-badge-old'}">${isCurrent ? 'NOW' : i === 1 ? '-1' : i === 2 ? '-2' : '-3'}</span>
          </div>
          <div class="sc-date" id="scdate_${key}">${formatShiftDate(s.date)}</div>
          ${DEPT_ORDER.map(dept => `
            <div class="sc-dept-row">
              <span class="sc-dname">${dept}</span>
              <div class="sc-bar-track"><div class="sc-bar-fill ${isCurrent ? 'sc-bar-current' : ''}" id="scbar_${key}_${dept}" style="width:0%"></div></div>
              <span class="sc-dpct" id="scpct_${key}_${dept}">--%</span>
            </div>
          `).join('')}
          <div class="sc-plant-avail" id="scavail_${key}">--%</div>
        </div>`;
    }).join('');
  }
  display.forEach((s, i) => {
    const key = `${safeKey(s.date)}_${s.shift}`;
    let totalAvail = 0;
    s.departments.forEach(d => {
      const pct = d.availability * 100;
      totalAvail += pct;
      const deptKey = d.department.toLowerCase();
      const barEl = container.querySelector(`#scbar_${key}_${deptKey}`);
      const pctEl = container.querySelector(`#scpct_${key}_${deptKey}`);
      if (barEl) barEl.style.width = `${pct.toFixed(0)}%`;
      if (pctEl) pctEl.textContent = `${pct.toFixed(0)}%`;
    });
    const plantAvail = s.departments.length ? totalAvail / s.departments.length : 0;
    const avEl = container.querySelector(`#scavail_${key}`);
    if (avEl) { avEl.textContent = `${plantAvail.toFixed(1)}%`; avEl.className = `sc-plant-avail ${kpiClass(plantAvail)}`; }
  });
}

function calcAvailability(m) {
  const d = m.shiftDurations;
  if (!d) return 0;
  const planned = (d.run_seconds || 0) + (d.idle_seconds || 0) + (d.alarm_seconds || 0) + (d.offline_seconds || 0);
  return planned > 0 ? (d.run_seconds / planned) * 100 : 0;
}

const STANDARD_MAP = {
  'heat_DKK1': 86.9, 'heat_DKK2': 86.89, 'heat_K3': 94.98, 'heat_K4': 94.09,
  'heat_K5': 90, 'heat_K6': 90, 'heat_K7': 96.18, 'heat_K8': 96.04,
  'press_AIDA630T': 6.45, 'press_M-20id-25': 6.3,
  'lathe_Rotor TK1': 93.45, 'lathe_Rotor TK4': 93.88,
};

function applyStandardMap() {
  const machines = scadaStore.state.machines;
  for (const [key, std] of Object.entries(STANDARD_MAP)) {
    if (machines[key]) machines[key].standard_cycle_time = std;
  }
}

// ---------------- Overview Page ---------------- //
let unsubscribe = null; 
let summaryTimer = null;
let shiftTimer = null;
let initialized = false;

export function productionOverviewMount(container) {
    const cardMap = new Map();
    container.innerHTML = `
    <div class="h-pd-overview"><h1>Production Overview</h1></div>
    <div class="summary-panel">
      <div class="sp-kpi-bar">
        <div class="sp-kpi-cell">
          <div class="sp-kpi-icon sp-icon-avail">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="sp-kpi-text"><div class="sp-kpi-label">Availability</div><div class="kpi-val" id="kpi-availability">--%</div></div>
        </div>
        <div class="sp-kpi-cell">
          <div class="sp-kpi-icon sp-icon-run"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="5,3 13,8 5,13" fill="currentColor"/></svg></div>
          <div class="sp-kpi-text"><div class="sp-kpi-label">Run</div><div class="sp-kpi-val" id="kpi-run">--:--:--</div></div>
        </div>
        <div class="sp-kpi-cell">
          <div class="sp-kpi-icon sp-icon-idle"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/></svg></div>
          <div class="sp-kpi-text"><div class="sp-kpi-label">Idle</div><div class="sp-kpi-val" id="kpi-idle">--:--:--</div></div>
        </div>
        <div class="sp-kpi-cell">
          <div class="sp-kpi-icon sp-icon-alarm"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 11H2L8 2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r="0.7" fill="currentColor"/></svg></div>
          <div class="sp-kpi-text"><div class="sp-kpi-label">Alarm</div><div class="sp-kpi-val" id="kpi-alarm">--:--:--</div></div>
        </div>
        <div class="sp-kpi-cell">
          <div class="sp-kpi-icon sp-icon-off"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 5L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 5L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/></svg></div>
          <div class="sp-kpi-text"><div class="sp-kpi-label">Offline</div><div class="sp-kpi-val" id="kpi-off">--:--:--</div></div>
        </div>
        <div class="sp-window-selector">
          <button class="sp-win-btn sp-win-active" data-window="shift">Shift</button>
          <button class="sp-win-btn" data-window="8">8 hr</button>
          <button class="sp-win-btn" data-window="24">24 hr</button>
        </div>
      </div>
    </div>
    <div class="shift-panel">
      <div class="sp-bottom">
        <div class="sp-trend">
          <div class="sp-trend-label">Plant availability — last 18 shifts</div>
          <div class="sp-trend-chart"><canvas id="trendChart"></canvas></div>
        </div>
        <div class="sp-cols" id="shift-col-grid"></div>
      </div>
    </div>
    <section id="machine-grid" class="machine-grid"></section>`;

    currentProductionContainer = container;
    container.querySelectorAll('.sp-win-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        container.querySelectorAll('.sp-win-btn').forEach(b => b.classList.remove('sp-win-active'));
        btn.classList.add('sp-win-active');
        currentWindow = btn.dataset.window;
        if (currentWindow !== 'shift') await fetchAndCacheWindow(currentWindow);
        updateKpiBar(container);
      });
    });

    loadAndRenderShiftPanel(container);
    summaryTimer = setInterval(() => { updateKpiBar(container); }, 1000);
    windowFetchTimer = setInterval(async () => {
      if (currentWindow !== 'shift' && currentProductionContainer) {
        await fetchAndCacheWindow(currentWindow);
        updateKpiBar(currentProductionContainer);
      }
    }, 60 * 1000);
    shiftTimer = setInterval(() => { loadAndRenderShiftPanel(container); }, 10000);

    const grid = container.querySelector('#machine-grid');
    unsubscribe = scadaStore.subscribe(state => {
        const machines = Object.entries(state.machines);
        const groups = {};
        machines.forEach(([id, m]) => { const [dept] = id.split('_'); if (!groups[dept]) groups[dept] = []; groups[dept].push([id, m]); });
        if (!initialized) {
            DEPT_ORDER.forEach(dept => {
                const list = groups[dept]; if (!list) return;
                const section = document.createElement('section');
                section.className = 'department-section'; section.dataset.dept = dept;
                section.innerHTML = `<h2 class="department-title">${dept.toUpperCase()}</h2><div class="department-grid"></div>`;
                grid.appendChild(section);
            });
            initialized = true;
        }
        machines.forEach(([id, m]) => {
            let card = cardMap.get(id);
            if (!card) {
                card = createMachineCard(id, m); cardMap.set(id, card);
                const dept = id.split('_')[0];
                const section = grid.querySelector(`[data-dept="${dept}"]`);
                section.querySelector('.department-grid').appendChild(card);
            } else { updateMachineCard(card, id, m); }
        });
    });
    applyStandardMap();

    function statusClass(machine) { return machine.status?.toLowerCase() || 'offline'; }

    function createMachineCard(id, m) {
        const card = document.createElement('div');
        card.className = `mc mc-${statusClass(m)}`;
        card.innerHTML = `
        <div class="mc-head">
          <div class="mc-name-row"><span class="mc-dot"></span><span class="mc-name">${id.split('_')[1]}</span></div>
          <span class="mc-badge">${m.status ?? '--'}</span>
        </div>
        <div class="mc-body">
          <div class="mc-img-col"><img src="/images/${id}.png" alt="${id}" onerror="this.style.opacity='.12'" /></div>
          <div class="mc-info-col">
            <div class="mc-info-row"><span class="mc-il">Part</span><span class="mc-iv mc-part"></span></div>
            <div class="mc-info-row"><span class="mc-il">Cycle time</span><span class="mc-iv mc-cycle"></span></div>
            <div class="mc-info-row"><span class="mc-il">Count shift</span><span class="mc-iv mc-count"></span></div>
            <div class="mc-info-row"><span class="mc-il">Availability</span><span class="mc-iv mc-avail"></span></div>
            <div class="mc-info-row"><span class="mc-il">Operator</span><span class="mc-iv mc-operator"></span></div>
          </div>
        </div>
        <div class="mc-dur">
          <div class="mc-dur-row">
            <div class="mc-dur-cell"><div class="mc-dur-dot mc-dot-run"></div><div class="mc-dur-time mc-dur-run-t"></div><div class="mc-dur-label">Run</div></div>
            <div class="mc-dur-cell"><div class="mc-dur-dot mc-dot-idle"></div><div class="mc-dur-time mc-dur-idle-t"></div><div class="mc-dur-label">Idle</div></div>
            <div class="mc-dur-cell"><div class="mc-dur-dot mc-dot-alarm"></div><div class="mc-dur-time mc-dur-alarm-t"></div><div class="mc-dur-label">Alarm</div></div>
            <div class="mc-dur-cell"><div class="mc-dur-dot mc-dot-offline"></div><div class="mc-dur-time mc-dur-offline-t"></div><div class="mc-dur-label">Offline</div></div>
          </div>
          <div class="mc-composite-bar">
            <div class="mc-cb-run"></div><div class="mc-cb-idle"></div><div class="mc-cb-alarm"></div><div class="mc-cb-offline"></div>
          </div>
        </div>
        <div class="mc-footer"><span class="mc-ts"></span><span class="mc-shift"></span></div>`;
        card.addEventListener('click', () => {
            const [dept, machine] = id.split('_');
            window.location.hash = `#production/machine_efficiency?dept=${dept}&machine=${machine}`;
        });
        updateMachineCard(card, id, m);
        return card;
    }

    function updateMachineCard(card, id, m) {
        const status = statusClass(m);
        card.className = `mc mc-${status}`;
        card.querySelector('.mc-badge').textContent = m.status ?? '--';
        card.querySelector('.mc-badge').className = `mc-badge mc-badge-${status}`;
        card.querySelector('.mc-dot').className = `mc-dot mc-dot-status-${status}`;
        card.querySelector('.mc-part').textContent     = m.context?.part_name  || '--';
        card.querySelector('.mc-operator').textContent = m.context?.operator_id || '--';
        card.querySelector('.mc-cycle').textContent    = m.tags?.cycle_time != null ? `${m.tags.cycle_time} s` : '-- s';
        card.querySelector('.mc-count').textContent    = `${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}`;
        const avail = calcAvailability(m);
        const availEl = card.querySelector('.mc-avail');
        availEl.textContent = `${avail.toFixed(1)}%`;
        availEl.style.color = avail >= 85 ? '#1D9E75' : avail >= 60 ? '#BA7517' : '#A32D2D';
        const d = m.shiftDurations || {};
        const run = d.run_seconds || 0, idle = d.idle_seconds || 0, alarm = d.alarm_seconds || 0, offline = d.offline_seconds || 0;
        card.querySelector('.mc-dur-run-t').textContent     = formatDuration(run,     m.status === 'RUNNING'  ? m.statusStartedAt : null);
        card.querySelector('.mc-dur-idle-t').textContent    = formatDuration(idle,    m.status === 'IDLE'     ? m.statusStartedAt : null);
        card.querySelector('.mc-dur-alarm-t').textContent   = formatDuration(alarm,   m.status === 'ALARM'    ? m.statusStartedAt : null);
        card.querySelector('.mc-dur-offline-t').textContent = formatDuration(offline, m.status === 'OFFLINE'  ? m.statusStartedAt : null);
        card.querySelector('.mc-cb-run').style.flex     = run;
        card.querySelector('.mc-cb-idle').style.flex    = idle;
        card.querySelector('.mc-cb-alarm').style.flex   = alarm;
        card.querySelector('.mc-cb-offline').style.flex = offline || 0.5;
        card.querySelector('.mc-ts').textContent    = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '--';
        card.querySelector('.mc-shift').textContent = m.shift ? `Shift ${m.shift}` : '';
    }
}

export function productionOverviewUnmount() {
  if (unsubscribe)        { unsubscribe(); unsubscribe = null; }
  if (summaryTimer)       { clearInterval(summaryTimer);     summaryTimer = null; }
  if (shiftTimer)         { clearInterval(shiftTimer);       shiftTimer = null; }
  if (windowFetchTimer)   { clearInterval(windowFetchTimer); windowFetchTimer = null; }
  currentProductionContainer = null;
  if (shiftTrendChart)    { shiftTrendChart.destroy(); shiftTrendChart = null; }
  initialized = false;
  shiftWindow = null;
  windowData  = null;
  currentWindow = 'shift';
}

// --------------- Machine Efficiency page --------------- //
let efficiencyUnsubscribe = null;
let stopwatchInterval     = null;

// ── ALL chart instances and state are MODULE-LEVEL so unmount can clean them ──
// But they must be RESET on every mount to avoid stale canvas references.
// Solution: declare here, reset inside mount. This is the fix for the
// "history chart shows old machine data on dept change" bug.
let oeeWindowTimer  = null;
let histAvailChart  = null;
let histPerfChart   = null;
let histOeeChart    = null;
let histAvailMode   = 'shifts';
let histPerfMode    = 'shifts';
let histOeeMode     = 'shifts';
let lastHistoryId   = null;

export function productionMachineEfficiencyView() {
  return `
    <div class="h-pd-overview"><h1>Machine Efficiency</h1></div>
    <div class="eff-layout">

      <!-- ── LEFT SIDEBAR ── -->
      <div class="eff-sidebar">
        <div class="eff-select-group">
          <label class="eff-label">Department</label>
          <select id="dept-select"><option value="">Select department</option></select>
        </div>
        <div class="eff-select-group">
          <label class="eff-label">Machine</label>
          <select id="machine-select" disabled><option value="">Select machine</option></select>
        </div>

        <!-- Machine status card -->
        <div id="eff-machine-card" class="eff-machine-card" style="display:none">
          <div class="eff-card-head">
            <div class="eff-card-name-row"><span class="eff-dot"></span><span class="eff-card-name"></span></div>
            <span class="eff-card-badge"></span>
          </div>
          <div class="eff-card-img"><img class="eff-img" src="" alt="" onerror="this.style.opacity='.12'"/></div>
          <div class="eff-info-grid">
            <span class="eff-il">Part</span>                  <span class="eff-iv eff-part"></span>
            <span class="eff-il">Standard cycle time</span>   <span id="eff-std-box" class="eff-iv"></span>
            <span class="eff-il">Cycle time</span>            <span class="eff-iv eff-cycle"></span>
            <span class="eff-il">Count / Plan</span>          <span class="eff-iv eff-count"></span>
            <span class="eff-il">Operator</span>              <span class="eff-iv eff-operator"></span>
          </div>
          <div class="eff-dur-block">
            <div class="eff-dur-row">
              <div class="eff-dur-cell"><div class="eff-dur-dot eff-dot-run"></div><div class="eff-dur-time eff-t-run"></div><div class="eff-dur-lbl">Run</div></div>
              <div class="eff-dur-cell"><div class="eff-dur-dot eff-dot-idle"></div><div class="eff-dur-time eff-t-idle"></div><div class="eff-dur-lbl">Idle</div></div>
              <div class="eff-dur-cell"><div class="eff-dur-dot eff-dot-alarm"></div><div class="eff-dur-time eff-t-alarm"></div><div class="eff-dur-lbl">Alarm</div></div>
              <div class="eff-dur-cell"><div class="eff-dur-dot eff-dot-offline"></div><div class="eff-dur-time eff-t-offline"></div><div class="eff-dur-lbl">Offline</div></div>
            </div>
            <div class="eff-composite-bar">
              <div class="eff-cb-run"></div><div class="eff-cb-idle"></div>
              <div class="eff-cb-alarm"></div><div class="eff-cb-offline"></div>
            </div>
          </div>
        </div>

        <!-- ── Part history panel ── -->
        <div id="eff-part-history" class="eff-part-history" style="display:none">
          <div class="eff-part-history-head">
            <span class="eff-chart-title">Part history</span>
            <select id="part-history-month" class="adm-select"></select>
          </div>
          <div id="eff-part-history-list" class="eff-part-history-list">
            <div class="eff-tl-loading">Loading...</div>
          </div>
        </div>

      </div>

      <!-- ── RIGHT MAIN ── -->
      
      <div class="eff-main">
        <div class="eff-first-row">
          <!-- OEE row -->
          <div id="eff-oee-row" class="eff-oee-row" style="display:none">
            <div class="eff-oee-window">
              <button class="eff-oee-win-btn eff-oee-win-active" data-win="shift">Shift</button>
              <button class="eff-oee-win-btn" data-win="8">8 hr</button>
              <button class="eff-oee-win-btn" data-win="24">24 hr</button>
            </div>
            <div class="eff-oee-box"><div class="eff-oee-label">Availability</div><div class="eff-oee-val" id="oee-avail">--%</div></div>
            <div class="eff-oee-box"><div class="eff-oee-label">Performance</div><div class="eff-oee-val" id="oee-perf">--%</div></div>
            <div class="eff-oee-box"><div class="eff-oee-label">Quality</div><div class="eff-oee-val" id="oee-qual">100%</div></div>
            <div class="eff-oee-box eff-oee-total"><div class="eff-oee-label">OEE</div><div class="eff-oee-val" id="oee-total">--%</div></div>
          </div>

          <!-- Cycle time chart -->
          <div id="eff-chart-wrap" class="eff-chart-wrap" style="display:none">
            <div class="eff-chart-header">
              <span class="eff-chart-title">Cycle time history</span>
              <span class="eff-chart-sub" id="eff-std-label"></span>
            </div>
            <div class="eff-chart-container"><canvas id="cycleChart"></canvas></div>
          </div>
        </div>

        <!-- Timeline -->
        <div id="eff-timeline-wrap" class="eff-timeline-wrap" style="display:none">
          <div class="eff-chart-header">
            <span class="eff-chart-title">Status timeline</span>
            <div class="eff-timeline-controls">
              <select id="tl-shift" class="adm-select">
                <option value="current">Current shift</option>
                <option value="A">Shift A (06:00–14:00)</option>
                <option value="B">Shift B (14:00–22:00)</option>
                <option value="C">Shift C (22:00–06:00)</option>
                <option value="custom">Custom range</option>
              </select>
              <div id="tl-custom-range" class="eff-tl-custom" style="display:none">
                <input type="date" id="tl-from-date" class="adm-input adm-input-date"/>
                <input type="time" id="tl-from-time" class="adm-input" style="width:90px" value="06:00"/>
                <span style="font-size:11px;color:#aaa">to</span>
                <input type="date" id="tl-to-date" class="adm-input adm-input-date"/>
                <input type="time" id="tl-to-time" class="adm-input" style="width:90px" value="14:00"/>
                <button id="tl-load-btn" class="adm-btn" style="padding:4px 10px;font-size:11px">Load</button>
              </div>
            </div>
          </div>
          <div id="eff-timeline-canvas" class="eff-timeline-canvas">
            <div class="eff-tl-loading">Select a machine to view timeline</div>
          </div>
          <div class="eff-tl-legend">
            <span class="eff-tl-leg"><span class="eff-tl-swatch" style="background:#1D9E75"></span>Running</span>
            <span class="eff-tl-leg"><span class="eff-tl-swatch" style="background:#BA7517"></span>Idle</span>
            <span class="eff-tl-leg"><span class="eff-tl-swatch" style="background:#A32D2D"></span>Alarm</span>
            <span class="eff-tl-leg"><span class="eff-tl-swatch" style="background:#607d8b"></span>Stop</span>
            <span class="eff-tl-leg"><span class="eff-tl-swatch" style="background:#888"></span>Offline</span>
          </div>
        </div>

        <!-- Empty state -->
        <div id="eff-empty" class="eff-empty">Select a department and machine to view efficiency data</div>

        <!-- History charts -->
        <div id="eff-history-section" style="display:none">
          <div class="eff-hist-wrap">

            <div class="eff-hist-header">
              <span class="eff-chart-title">Availability history</span>
              <select id="hist-avail-mode" class="adm-select">
                <option value="shifts">Last 31 shifts</option>
                <option value="days">Last 31 days</option>
                <option value="months">Last 12 months</option>
              </select>
            </div>
            
            <div class="eff-hist-container"><canvas id="histAvailChart"></canvas></div>
          </div>
          <div class="eff-hist-wrap">
            <div class="eff-hist-header">
              <span class="eff-chart-title">Performance history</span>
              <select id="hist-perf-mode" class="adm-select">
                <option value="shifts">Last 31 shifts</option>
                <option value="days">Last 31 days</option>
                <option value="months">Last 12 months</option>
              </select>
            </div>
            <div class="eff-hist-container"><canvas id="histPerfChart"></canvas></div>
            <div id="hist-perf-na" class="eff-hist-na" style="display:none">No standard cycle time set — Performance cannot be calculated.</div>
          </div>
          <div class="eff-hist-wrap">
            <div class="eff-hist-header">
              <span class="eff-chart-title">OEE history</span>
              <select id="hist-oee-mode" class="adm-select">
                <option value="shifts">Last 31 shifts</option>
                <option value="days">Last 31 days</option>
                <option value="months">Last 12 months</option>
              </select>
            </div>
            <div class="eff-hist-container"><canvas id="histOeeChart"></canvas></div>
            <div id="hist-oee-na" class="eff-hist-na" style="display:none">No standard cycle time set — OEE cannot be calculated.</div>
          </div>
        </div>

      </div>
    </div>`;
}

export function productionMachineEfficiencyMount(container) {
  applyStandardMap();

  // ── Reset ALL chart state on every mount ─────────────────────────────────
  // This is the core fix: canvas elements are new on every mount,
  // so old Chart instances must be destroyed before reassigning.
  if (histAvailChart) { histAvailChart.destroy(); histAvailChart = null; }
  if (histPerfChart)  { histPerfChart.destroy();  histPerfChart  = null; }
  if (histOeeChart)   { histOeeChart.destroy();   histOeeChart   = null; }
  if (oeeWindowTimer) { clearInterval(oeeWindowTimer); oeeWindowTimer = null; }
  histAvailMode = 'shifts';
  histPerfMode  = 'shifts';
  histOeeMode   = 'shifts';
  lastHistoryId = null;

  const deptSelect    = container.querySelector('#dept-select');
  const machineSelect = container.querySelector('#machine-select');
  const machineCard   = container.querySelector('#eff-machine-card');
  const oeeRow        = container.querySelector('#eff-oee-row');
  const chartWrap     = container.querySelector('#eff-chart-wrap');
  const emptyMsg      = container.querySelector('#eff-empty');

  let selectedId      = null;
  let cycleChart      = null;
  let deepLinkDone    = false;
  let lastTimelineKey = null;
  let oeeWindow       = 'shift';
  let oeeWindowData   = null;

  const today = new Date().toISOString().split('T')[0];
  setTimeout(() => {
    const fd = container.querySelector('#tl-from-date');
    const td = container.querySelector('#tl-to-date');
    if (fd) fd.value = today;
    if (td) td.value = today;
  }, 0);

  // ── helpers ──────────────────────────────────────────────────────────────
  function getStandardCycleTime(m) { return m?.standard_cycle_time ?? null; }

  function calcAvailabilityPct(m) {
    const d = m?.shiftDurations;
    if (!d) return 0;
    const planned = (d.run_seconds||0)+(d.idle_seconds||0)+(d.alarm_seconds||0)+(d.offline_seconds||0);
    return planned > 0 ? (d.run_seconds / planned) * 100 : 0;
  }

  function calcPerformancePct(m) {
    const std = getStandardCycleTime(m);
    if (!std) return null;
    const runTime = m?.shiftDurations?.run_seconds || 0;
    const count   = m?.tags?.count_shift || 0;
    if (!runTime || !count) return 0;
    return Math.min((std * count) / runTime * 100, 200);
  }

  function calcOEE(avail, perf) {
    if (perf === null) return null;
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

  // ── History chart helpers ─────────────────────────────────────────────────
  function histBarColor(value) {
    if (value === null)  return 'rgba(200,200,200,0.5)';
    if (value >= 85)     return 'rgba(29,158,117,0.75)';
    if (value >= 60)     return 'rgba(186,117,23,0.75)';
    return                      'rgba(163,45,45,0.75)';
  }

  function buildBarColors(values) { return values.map(histBarColor); }

  // function makeHistChartConfig(labels, values, title) {
  //   const colors = buildBarColors(values);
  //   return {
  //     type: 'bar',
  //     data: {
  //       labels,
  //       datasets: [{ label: title, data: values.map(v => v ?? 0), backgroundColor: colors, borderColor: colors.map(c => c.replace('0.75','1')), borderWidth: 1, borderRadius: 3 }]
  //     },
  //     options: {
  //       animation: false, responsive: true, maintainAspectRatio: false,
  //       plugins: {
  //         legend: { display: false },
  //         tooltip: { callbacks: { label: ctx => { const raw = values[ctx.dataIndex]; return raw !== null ? `${raw.toFixed(1)}%` : 'N/A'; } } },
  //         annotation: { annotations: { target85: { type:'line', yMin:85, yMax:85, borderColor:'rgba(29,158,117,0.5)', borderWidth:1, borderDash:[4,4], label:{ display:true, content:'85%', position:'end', color:'#1D9E75', font:{size:9} } } } }
  //       },
  //       scales: {
  //         x: { ticks: { font:{size:9}, maxRotation:45, minRotation:30 }, grid: { display:false } },
  //         y: { min:0, max:100, ticks: { font:{size:9}, callback: v=>`${v}%`, maxTicksLimit:6 }, grid: { color:'rgba(0,0,0,0.05)' } }
  //       }
  //     }
  //   };
  // }
  function makeHistChartConfig(labels, values, title) {
    const colors = buildBarColors(values);
  
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title,
          data:  values.map(v => v ?? 0),
          backgroundColor: colors,
          borderColor:     colors.map(c => c.replace('0.75', '1')),
          borderWidth: 1,
          borderRadius: 3,
          // Store original values (including nulls) as a custom property
          // so the tooltip can distinguish "0" from "no data"
          originalValues: values.slice()
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                // ── Read from the dataset's own originalValues — always current ──
                const originals = ctx.dataset.originalValues;
                const raw = originals ? originals[ctx.dataIndex] : ctx.parsed.y;
                return raw !== null && raw !== undefined
                  ? `${Number(raw).toFixed(1)}%`
                  : 'N/A';
              }
            }
          },
          annotation: {
            annotations: {
              target85: {
                type: 'line',
                yMin: 85, yMax: 85,
                borderColor: 'rgba(29,158,117,0.5)',
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                  display: true,
                  content: '85%',
                  position: 'end',
                  color: '#1D9E75',
                  font: { size: 9 }
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 30 },
            grid:  { display: false }
          },
          y: {
            min: 0, max: 100,
            ticks: { font: { size: 9 }, callback: v => `${v}%`, maxTicksLimit: 6 },
            grid:  { color: 'rgba(0,0,0,0.05)' }
          }
        }
      }
    };
  }
  // function renderHistChart(canvasId, existingChart, labels, values, title) {
  //   const canvas = document.getElementById(canvasId);
  //   if (!canvas) return existingChart;
  //   if (!existingChart) return new Chart(canvas, makeHistChartConfig(labels, values, title));
  //   const colors = buildBarColors(values);
  //   existingChart.data.labels                       = labels;
  //   existingChart.data.datasets[0].data             = values.map(v => v ?? 0);
  //   existingChart.data.datasets[0].backgroundColor  = colors;
  //   existingChart.data.datasets[0].borderColor      = colors.map(c => c.replace('0.75','1'));
  //   existingChart.update('none');
  //   return existingChart;
  // }

  // ── Destroy all history charts (called on dept change) ────────────────────

  function renderHistChart(canvasId, existingChart, labels, values, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return existingChart;
  
    if (!existingChart) {
      return new Chart(canvas, makeHistChartConfig(labels, values, title));
    }
  
    // Update in-place — never recreate the canvas
    const colors = buildBarColors(values);
    existingChart.data.labels                              = labels;
    existingChart.data.datasets[0].data                   = values.map(v => v ?? 0);
    existingChart.data.datasets[0].backgroundColor        = colors;
    existingChart.data.datasets[0].borderColor            = colors.map(c => c.replace('0.75', '1'));
    // ── Keep originalValues in sync so tooltip always shows current data ──
    existingChart.data.datasets[0].originalValues         = values.slice();
    existingChart.update('none');
    return existingChart;
  }


  function destroyHistoryCharts() {
    if (histAvailChart) { histAvailChart.destroy(); histAvailChart = null; }
    if (histPerfChart)  { histPerfChart.destroy();  histPerfChart  = null; }
    if (histOeeChart)   { histOeeChart.destroy();   histOeeChart   = null; }
    lastHistoryId = null;
    histAvailMode = 'shifts'; histPerfMode = 'shifts'; histOeeMode = 'shifts';
    const histAvailSel = container.querySelector('#hist-avail-mode');
    const histPerfSel  = container.querySelector('#hist-perf-mode');
    const histOeeSel   = container.querySelector('#hist-oee-mode');
    if (histAvailSel) histAvailSel.value = 'shifts';
    if (histPerfSel)  histPerfSel.value  = 'shifts';
    if (histOeeSel)   histOeeSel.value   = 'shifts';
    const section = document.getElementById('eff-history-section');
    if (section) section.style.display = 'none';
  }

  async function loadHistoryCharts(id) {
    if (!id) return;
    const section = document.getElementById('eff-history-section');
    if (section) section.style.display = '';
    const [dept, ...mp] = id.split('_');
    const machine = mp.join('_');
    async function fetchMode(mode) {
      const res = await fetch(`/api/machine-history?dept=${dept}&machine=${encodeURIComponent(machine)}&mode=${mode}`, { credentials:'same-origin' });
      return res.json();
    }
    const [availData, perfData, oeeData] = await Promise.all([fetchMode(histAvailMode), fetchMode(histPerfMode), fetchMode(histOeeMode)]);

    if (availData.success) {
      histAvailChart = renderHistChart('histAvailChart', histAvailChart, availData.data.map(d=>d.label), availData.data.map(d=>d.avail), 'Availability');
    }
    const perfNaEl   = document.getElementById('hist-perf-na');
    const perfCanvas = document.getElementById('histPerfChart');
    if (perfData.success) {
      const hasPerf = perfData.data.some(d => d.perf !== null);
      if (!hasPerf || !perfData.std_cycle_time) { if (perfNaEl) perfNaEl.style.display=''; if (perfCanvas) perfCanvas.style.display='none'; }
      else {
        if (perfNaEl) perfNaEl.style.display='none'; if (perfCanvas) perfCanvas.style.display='';
        histPerfChart = renderHistChart('histPerfChart', histPerfChart, perfData.data.map(d=>d.label), perfData.data.map(d=>d.perf), 'Performance');
      }
    }
    const oeeNaEl   = document.getElementById('hist-oee-na');
    const oeeCanvas = document.getElementById('histOeeChart');
    if (oeeData.success) {
      const hasOee = oeeData.data.some(d => d.oee !== null);
      if (!hasOee || !oeeData.std_cycle_time) { if (oeeNaEl) oeeNaEl.style.display=''; if (oeeCanvas) oeeCanvas.style.display='none'; }
      else {
        if (oeeNaEl) oeeNaEl.style.display='none'; if (oeeCanvas) oeeCanvas.style.display='';
        histOeeChart = renderHistChart('histOeeChart', histOeeChart, oeeData.data.map(d=>d.label), oeeData.data.map(d=>d.oee), 'OEE');
      }
    }
  }

  // ── Part history panel ────────────────────────────────────────────────────
  async function loadPartHistory(id, month = null) {
    const panel   = document.getElementById('eff-part-history');
    const listEl  = document.getElementById('eff-part-history-list');
    const monthSel = container.querySelector('#part-history-month');
    if (!panel || !listEl || !monthSel) return;

    panel.style.display = '';
    listEl.innerHTML = '<div class="eff-tl-loading">Loading...</div>';

    const [dept, ...mp] = id.split('_');
    const machine = mp.join('_');

    const params = new URLSearchParams({ dept, machine });
    if (month) params.set('month', month);

    const res  = await fetch(`/api/machine-part-history?${params}`, { credentials:'same-origin' });
    const data = await res.json();

    if (!data.success || !data.available_months.length) {
      listEl.innerHTML = '<div class="eff-tl-loading">No production data</div>';
      return;
    }

    // Build month dropdown (only if it changed — avoid flicker)
    if (monthSel.options.length !== data.available_months.length) {
      monthSel.innerHTML = data.available_months.map(m => {
        const [y, mo] = m.split('-');
        const label = new Date(Number(y), Number(mo)-1, 1).toLocaleDateString('en-GB', { month:'short', year:'numeric' });
        return `<option value="${m}">${label}</option>`;
      }).join('');
    }
    monthSel.value = data.selected_month;

    if (!data.parts.length) {
      listEl.innerHTML = '<div class="eff-tl-loading">No parts in this month</div>';
      return;
    }

    // Find max for bar scaling
    const maxCount = Math.max(...data.parts.map(p => p.total_production));

    listEl.innerHTML = data.parts.map(p => {
      const barPct = maxCount > 0 ? (p.total_production / maxCount * 100).toFixed(1) : 0;
      return `
        <div class="ph-row">
          <div class="ph-name" title="${p.part_name}">${p.part_name || '(no part)'}</div>
          <div class="ph-bar-wrap">
            <div class="ph-bar-fill" style="width:${barPct}%"></div>
          </div>
          <div class="ph-count">${p.total_production.toLocaleString()}</div>
        </div>`;
    }).join('');
  }

  // Month selector change
  container.addEventListener('change', e => {
    if (e.target.id !== 'part-history-month') return;
    if (selectedId) loadPartHistory(selectedId, e.target.value);
  });

  // ── Sidebar card update ───────────────────────────────────────────────────
  function updateSidebarCard(id, m) {
    if (!m) return;
    const status = m.status?.toLowerCase() || 'offline';
    machineCard.style.display = '';
    machineCard.className = `eff-machine-card eff-mc-${status}`;
    container.querySelector('.eff-card-name').textContent = id.split('_')[1];
    const badge = container.querySelector('.eff-card-badge');
    badge.textContent = m.status ?? '--';
    badge.className   = `eff-card-badge eff-badge-${status}`;
    container.querySelector('.eff-dot').className = `eff-dot eff-dot-${status}`;
    container.querySelector('.eff-img').src = `/images/${id}.png`;
    container.querySelector('.eff-img').alt = id;
    container.querySelector('.eff-part').textContent     = m.context?.part_name   || '--';
    container.querySelector('.eff-operator').textContent = m.context?.operator_id || '--';
    container.querySelector('.eff-cycle').textContent    = m.tags?.cycle_time != null ? `${m.tags.cycle_time} s` : '-- s';
    container.querySelector('.eff-count').textContent    = `${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}`;
    const d = m.shiftDurations || {};
    const run = d.run_seconds||0, idle = d.idle_seconds||0, alarm = d.alarm_seconds||0, offline = d.offline_seconds||0;
    container.querySelector('.eff-t-run').textContent     = formatDuration(run,     status==='running'  ? m.statusStartedAt : null);
    container.querySelector('.eff-t-idle').textContent    = formatDuration(idle,    status==='idle'     ? m.statusStartedAt : null);
    container.querySelector('.eff-t-alarm').textContent   = formatDuration(alarm,   status==='alarm'    ? m.statusStartedAt : null);
    container.querySelector('.eff-t-offline').textContent = formatDuration(offline, status==='offline'  ? m.statusStartedAt : null);
    container.querySelector('.eff-cb-run').style.flex     = run;
    container.querySelector('.eff-cb-idle').style.flex    = idle;
    container.querySelector('.eff-cb-alarm').style.flex   = alarm;
    container.querySelector('.eff-cb-offline').style.flex = offline || 0.5;
  }

  // ── OEE row update ────────────────────────────────────────────────────────
  function updateOeeRow(m) {
    if (!m) return;
    oeeRow.style.display = '';
    let avail, perf;
    if (oeeWindow === 'shift') {
      avail = calcAvailabilityPct(m);
      perf  = calcPerformancePct(m);
    } else {
      if (!oeeWindowData) return;
      const d = oeeWindowData;
      const planned = d.run_seconds + d.idle_seconds + d.alarm_seconds + d.offline_seconds;
      avail = planned > 0 ? (d.run_seconds / planned) * 100 : 0;
      const std = getStandardCycleTime(m);
      perf = (std && d.run_seconds > 0 && d.count_output > 0) ? Math.min((std * d.count_output) / d.run_seconds * 100, 100) : null;
    }
    const oee = calcOEE(avail, perf);
    const availEl = container.querySelector('#oee-avail');
    availEl.textContent = `${avail.toFixed(1)}%`; availEl.style.color = oeeColor(avail);
    const perfEl = container.querySelector('#oee-perf');
    if (perf === null) { perfEl.textContent = 'N/A'; perfEl.style.color = '#aaa'; }
    else { perfEl.textContent = `${perf.toFixed(1)}%`; perfEl.style.color = oeeColor(perf); }
    const oeeEl = container.querySelector('#oee-total');
    if (oee === null) { oeeEl.textContent = 'N/A'; oeeEl.style.color = '#aaa'; }
    else { oeeEl.textContent = `${oee.toFixed(1)}%`; oeeEl.style.color = oeeColor(oee); }
  }

  async function fetchOeeWindow(id, win) {
    if (!id) return;
    const [dept, ...mp] = id.split('_');
    const machine = mp.join('_');
    try {
      const res = await fetch(`/api/machine-oee?dept=${dept}&machine=${encodeURIComponent(machine)}&window=${win}`, { credentials:'same-origin' });
      oeeWindowData = await res.json();
    } catch(e) { console.error('OEE fetch error:', e); oeeWindowData = null; }
    if (selectedId) updateOeeRow(scadaStore.state.machines[selectedId]);
  }

  // ── Cycle chart ───────────────────────────────────────────────────────────
  function updateCycleChart(m) {
    const history = m?.cycleHistory ?? [];
    const std = getStandardCycleTime(m);
    chartWrap.style.display = ''; emptyMsg.style.display = 'none';
    const stdLabel = container.querySelector('#eff-std-label');
    const stdbox   = container.querySelector('#eff-std-box');
    stdLabel.textContent = std ? `Standard: ${std} s` : 'No standard set';
    if (stdbox) { stdbox.textContent = std ? `${std} s` : '--'; stdbox.style.display = ''; }
    const labels = history.map(p => new Date(p.t).toLocaleTimeString());
    const values = history.map(p => p.v);
    const ma     = movingAverage(values, 5);
    const maxVal = values.length ? Math.max(...values) : (std ? std * 2 : 100);
    const rawMax = std ? Math.max(maxVal * 1.1, std * 1.8) : maxVal * 1.2 || 100;
    const yMax = Math.ceil(rawMax * 10) / 10;
    const greenMax  = std ? std * 1.0   : null;
    const yellowMax = std ? std * 1.341 : null;
    const redMax    = std ? yMax        : null;
    const annotations = std ? {
      greenZone:  { type:'box', yMin:0,         yMax:greenMax,  backgroundColor:'rgba(29,158,117,0.08)',  borderColor:'rgba(29,158,117,0.3)',  borderWidth:1 },
      yellowZone: { type:'box', yMin:greenMax,  yMax:yellowMax, backgroundColor:'rgba(186,117,23,0.08)', borderColor:'rgba(186,117,23,0.3)', borderWidth:1 },
      redZone:    { type:'box', yMin:yellowMax, yMax:redMax,    backgroundColor:'rgba(163,45,45,0.06)',   borderColor:'rgba(163,45,45,0.25)',  borderWidth:1 },
      stdLine:    { type:'line', yMin:std, yMax:std, borderColor:'#1D9E75', borderWidth:1.5, borderDash:[4,4], label:{ display:true, content:`Std ${std}s`, position:'end', color:'#1D9E75', font:{size:10} } }
    } : {};
    if (!cycleChart) {
      const ctx = container.querySelector('#cycleChart');
      cycleChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [
          { label:'Cycle time (s)', data:values, borderColor:'#378ADD', backgroundColor:'rgba(55,138,221,0.08)', fill:true, borderWidth:2, tension:0.3, pointRadius:3, pointHoverRadius:5, order:2 },
          { label:'Moving avg (5)', data:ma, borderColor:'#BA7517', borderDash:[5,4], fill:false, borderWidth:1.5, pointRadius:0, tension:0.4, order:1 }
        ]},
        options: {
          animation:false, responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
          scales: {
            x: { ticks:{font:{size:10},maxTicksLimit:8,maxRotation:0}, grid:{display:false} },
            y: { beginAtZero:true, max:yMax, ticks:{font:{size:10},callback:v=>`${v}s`}, grid:{color:'rgba(0,0,0,0.05)'} }
          },
          plugins: { legend:{display:true,labels:{font:{size:11},boxWidth:14}}, annotation:{annotations} }
        }
      });
    } else {
      cycleChart.data.labels = labels; cycleChart.data.datasets[0].data = values; cycleChart.data.datasets[1].data = ma;
      cycleChart.options.scales.y.max = yMax;
      if (cycleChart.options.plugins?.annotation) cycleChart.options.plugins.annotation.annotations = annotations;
      cycleChart.update('none');
    }
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function renderSelected(id) {
    const m = scadaStore.state.machines[id];
    if (!m) return;
    updateSidebarCard(id, m);
    updateOeeRow(m);
    updateCycleChart(m);
    const shiftVal = container.querySelector('#tl-shift')?.value ?? 'current';
    const tlKey    = `${id}__${shiftVal}`;
    if (shiftVal !== 'custom' && tlKey !== lastTimelineKey) {
      lastTimelineKey = tlKey;
      const range = getShiftRange(shiftVal);
      loadTimeline(id, range.from, range.to);
    }
    if (id !== lastHistoryId) {
      lastHistoryId = id;
      loadHistoryCharts(id);
      loadPartHistory(id);
    }
  }

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  function buildDepts(state) {
    if (deptSelect.options.length > 1) return;
    const depts = [...new Set(Object.keys(state.machines).map(id => id.split('_')[0]))];
    depts.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d.toUpperCase(); deptSelect.appendChild(o); });
  }

  function buildMachines(state, dept) {
    machineSelect.innerHTML = '<option value="">Select machine</option>';
    machineSelect.disabled  = false;
    Object.keys(state.machines).filter(id => id.startsWith(dept + '_')).forEach(id => {
      const o = document.createElement('option'); o.value = id.split('_')[1]; o.textContent = id.split('_')[1]; machineSelect.appendChild(o);
    });
  }

  // OEE window selector
  oeeRow.addEventListener('click', async e => {
    const btn = e.target.closest('.eff-oee-win-btn');
    if (!btn) return;
    oeeRow.querySelectorAll('.eff-oee-win-btn').forEach(b => b.classList.remove('eff-oee-win-active'));
    btn.classList.add('eff-oee-win-active');
    oeeWindow = btn.dataset.win; oeeWindowData = null;
    if (oeeWindowTimer) { clearInterval(oeeWindowTimer); oeeWindowTimer = null; }
    if (oeeWindow === 'shift') {
      if (selectedId) updateOeeRow(scadaStore.state.machines[selectedId]);
    } else {
      await fetchOeeWindow(selectedId, oeeWindow);
      oeeWindowTimer = setInterval(() => { fetchOeeWindow(selectedId, oeeWindow); }, 60*1000);
    }
  });

  deptSelect.addEventListener('change', e => {
    const dept = e.target.value;
    if (!dept) return;
    buildMachines(scadaStore.state, dept);
    selectedId = null; lastTimelineKey = null;
    machineCard.style.display = 'none'; oeeRow.style.display = 'none';
    chartWrap.style.display = 'none'; emptyMsg.style.display = '';
    const wrap = container.querySelector('#eff-timeline-wrap');
    const canvasEl = container.querySelector('#eff-timeline-canvas');
    if (wrap)     wrap.style.display = 'none';
    if (canvasEl) canvasEl.innerHTML = '<div class="eff-tl-loading">Select a machine to view timeline</div>';
    const partPanel = document.getElementById('eff-part-history');
    if (partPanel) partPanel.style.display = 'none';
    destroyHistoryCharts();  // ← THE FIX: destroy old charts on dept change
  });

  machineSelect.addEventListener('change', e => {
    const machine = e.target.value;
    const dept    = deptSelect.value;
    if (!machine || !dept) return;
    selectedId = `${dept}_${machine}`;
    oeeWindow = 'shift'; oeeWindowData = null;
    if (oeeWindowTimer) { clearInterval(oeeWindowTimer); oeeWindowTimer = null; }
    oeeRow.querySelectorAll('.eff-oee-win-btn').forEach(b => b.classList.toggle('eff-oee-win-active', b.dataset.win === 'shift'));
    destroyHistoryCharts();  // ← also destroy on machine change within same dept
    renderSelected(selectedId);
  });

  // ── Timeline ──────────────────────────────────────────────────────────────
  const STATUS_COLOR = { RUNNING:'#1D9E75', IDLE:'#BA7517', ALARM:'#A32D2D', STOP:'#607d8b', OFFLINE:'#888888' };

  function getShiftRange(shiftKey) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();
    let currentShift = hour >= 6 && hour < 14 ? 'A' : hour >= 14 && hour < 22 ? 'B' : 'C';
    const shift = shiftKey === 'current' ? currentShift : shiftKey;
    let fromDate = date;
    if (shift === 'C' && hour < 6) { const y = new Date(now); y.setDate(y.getDate()-1); fromDate = y.toISOString().split('T')[0]; }
    const times = { A:['06:00','14:00'], B:['14:00','22:00'], C:['22:00','06:00'] };
    const [startT, endT] = times[shift];
    const toDate = shift === 'C' && hour >= 22 ? (() => { const t = new Date(now); t.setDate(t.getDate()+1); return t.toISOString().split('T')[0]; })() : date;
    const endFull = shiftKey === 'current' ? now.toISOString() : `${toDate}T${endT}:00`;
    return { from: `${fromDate}T${startT}:00`, to: endFull };
  }

  function renderTimeline(canvasEl, segments, fromMs, toMs) {
    const totalMs = toMs - fromMs;
    if (totalMs <= 0) return;
    const bars = segments.map(seg => {
      const leftPct  = ((seg.startMs - fromMs) / totalMs * 100).toFixed(3);
      const widthPct = (seg.durationMs / totalMs * 100).toFixed(3);
      const color    = STATUS_COLOR[seg.status] || '#ccc';
      const mins     = Math.round(seg.durationMs / 60000);
      const label    = mins >= 2 ? `${mins}m` : '';
      const startLabel = new Date(seg.startMs).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      return `<div class="eff-tl-seg" style="left:${leftPct}%;width:${widthPct}%;background:${color};" title="${startLabel} · ${seg.status} · ${mins} min${seg.part_name?' · '+seg.part_name:''}"><span class="eff-tl-seg-label">${label}</span></div>`;
    }).join('');
    const axisLabels = [];
    const startHour = new Date(fromMs); startHour.setMinutes(0,0,0);
    startHour.setHours(startHour.getHours() + (new Date(fromMs).getMinutes() > 0 ? 1 : 0));
    let t = startHour.getTime();
    while (t <= toMs) {
      const pct = ((t - fromMs) / totalMs * 100).toFixed(2);
      const label = new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      axisLabels.push(`<div class="eff-tl-tick" style="left:${pct}%">${label}</div>`);
      t += 3600000;
    }
    canvasEl.innerHTML = `<div class="eff-tl-bar-wrap"><div class="eff-tl-bar">${bars}</div></div><div class="eff-tl-axis">${axisLabels.join('')}</div>`;
  }

  async function loadTimeline(id, fromISO, toISO) {
    const wrap     = container.querySelector('#eff-timeline-wrap');
    const canvasEl = container.querySelector('#eff-timeline-canvas');
    if (!wrap || !canvasEl) return;
    wrap.style.display = ''; canvasEl.innerHTML = '<div class="eff-tl-loading">Loading...</div>';
    const [dept, ...mp] = id.split('_'); const machine = mp.join('_');
    const params = new URLSearchParams({ dept, machine, from:fromISO, to:toISO });
    const res = await fetch(`/api/machine-timeline?${params}`, { credentials:'same-origin' });
    if (!res.ok) { canvasEl.innerHTML = '<div class="eff-tl-loading">Failed to load</div>'; return; }
    const data = await res.json();
    if (!data.segments?.length) { canvasEl.innerHTML = '<div class="eff-tl-loading">No data in this range</div>'; return; }
    renderTimeline(canvasEl, data.segments, new Date(data.from).getTime(), new Date(data.to).getTime());
  }

  const tlShift   = container.querySelector('#tl-shift');
  const tlCustom  = container.querySelector('#tl-custom-range');
  const tlLoadBtn = container.querySelector('#tl-load-btn');

  tlShift?.addEventListener('change', () => {
    const isCustom = tlShift.value === 'custom';
    tlCustom.style.display = isCustom ? 'flex' : 'none';
    if (!isCustom && selectedId) { lastTimelineKey = null; const range = getShiftRange(tlShift.value); loadTimeline(selectedId, range.from, range.to); }
  });

  tlLoadBtn?.addEventListener('click', () => {
    if (!selectedId) return;
    const fromDate = container.querySelector('#tl-from-date').value;
    const fromTime = container.querySelector('#tl-from-time').value;
    const toDate   = container.querySelector('#tl-to-date').value;
    const toTime   = container.querySelector('#tl-to-time').value;
    if (!fromDate || !toDate) return;
    lastTimelineKey = null;
    loadTimeline(selectedId, `${fromDate}T${fromTime}:00`, `${toDate}T${toTime}:00`);
  });

  // History mode selectors
  const histAvailSel = container.querySelector('#hist-avail-mode');
  const histPerfSel  = container.querySelector('#hist-perf-mode');
  const histOeeSel   = container.querySelector('#hist-oee-mode');

  async function refetchHistChart(mode, chartRef, canvasId, valueKey, naId) {
    if (!selectedId) return;
    const [dept, ...mp] = selectedId.split('_'); const machine = mp.join('_');
    const res  = await fetch(`/api/machine-history?dept=${dept}&machine=${encodeURIComponent(machine)}&mode=${mode}`, { credentials:'same-origin' });
    const data = await res.json();
    if (!data.success) return;
    const naEl = document.getElementById(naId);
    const cvs  = document.getElementById(canvasId);
    const hasVal = data.data.some(d => d[valueKey] !== null);
    if (!hasVal || (valueKey !== 'avail' && !data.std_cycle_time)) {
      if (naEl) naEl.style.display = ''; if (cvs) cvs.style.display = 'none'; return;
    }
    if (naEl) naEl.style.display = 'none'; if (cvs) cvs.style.display = '';
    return renderHistChart(canvasId, chartRef, data.data.map(d=>d.label), data.data.map(d=>d[valueKey]), valueKey);
  }

  histAvailSel?.addEventListener('change', async () => { histAvailMode = histAvailSel.value; histAvailChart = await refetchHistChart(histAvailMode, histAvailChart, 'histAvailChart', 'avail', 'hist-avail-na') ?? histAvailChart; });
  histPerfSel?.addEventListener('change',  async () => { histPerfMode  = histPerfSel.value;  histPerfChart  = await refetchHistChart(histPerfMode,  histPerfChart,  'histPerfChart',  'perf', 'hist-perf-na') ?? histPerfChart; });
  histOeeSel?.addEventListener('change',   async () => { histOeeMode   = histOeeSel.value;   histOeeChart   = await refetchHistChart(histOeeMode,   histOeeChart,   'histOeeChart',   'oee',  'hist-oee-na') ?? histOeeChart; });

  // Deep link
  function applyDeepLink(state) {
    const hash = location.hash; const qi = hash.indexOf('?'); if (qi === -1) return false;
    const params = new URLSearchParams(hash.substring(qi + 1));
    const dept = params.get('dept'); const machine = params.get('machine');
    if (!dept || !machine || !state.machines[`${dept}_${machine}`]) return false;
    deptSelect.value = dept; buildMachines(state, dept); machineSelect.value = machine;
    selectedId = `${dept}_${machine}`; renderSelected(selectedId); return true;
  }

  // Store subscription
  efficiencyUnsubscribe = scadaStore.subscribe(state => {
    buildDepts(state);
    if (!deepLinkDone) deepLinkDone = applyDeepLink(state);
    if (selectedId) renderSelected(selectedId);
  });
}

export function productionMachineEfficiencyUnmount() {
  if (efficiencyUnsubscribe) { efficiencyUnsubscribe(); efficiencyUnsubscribe = null; }
  if (stopwatchInterval)     { clearInterval(stopwatchInterval); stopwatchInterval = null; }
  if (oeeWindowTimer)        { clearInterval(oeeWindowTimer);    oeeWindowTimer = null; }
  if (histAvailChart)        { histAvailChart.destroy(); histAvailChart = null; }
  if (histPerfChart)         { histPerfChart.destroy();  histPerfChart  = null; }
  if (histOeeChart)          { histOeeChart.destroy();   histOeeChart   = null; }
  lastHistoryId = null;
  histAvailMode = 'shifts'; histPerfMode = 'shifts'; histOeeMode = 'shifts';
}

// --------------- HISTORY page --------------- //
export function productionProductionHistoryView() {
  return `<div class="card"><h2>Production History</h2><div class="card"><h3>📡 Live PLC Data</h3><pre id="plc-data">No data...</pre></div></div>`;
}
export async function productionProductionHistoryMount() {
  const dataEl = document.getElementById('plc-data');
  unsubscribe = scadaStore.subscribe((data) => { dataEl.textContent = JSON.stringify(data, null, 2); });
}
export function productionProductionHistoryUnmount() { if (unsubscribe) unsubscribe(); }

// --------------- STAFF MANAGEMENT page --------------- //
export function productionStaffManagementView() {
  return `<h1>👨‍👨‍👦‍ Staff Management</h1><div class="card"><p>Waiting for development</p></div>`;
}