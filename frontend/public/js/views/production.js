
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
    let run     = d.run_seconds     || 0;
    let idle    = d.idle_seconds    || 0;
    let alarm   = d.alarm_seconds   || 0;
    let offline = d.offline_seconds || 0;
    // Add live seconds for the current status not yet ticked into shiftDurations
    if (m.statusStartedAt) {
      const live = Math.floor((Date.now() - m.statusStartedAt) / 1000);
      if (m.status === 'RUNNING') run     += live;
      if (m.status === 'IDLE')    idle    += live;
      if (m.status === 'ALARM')   alarm   += live;
      if (m.status === 'OFFLINE') offline += live;
    }
    const planned = run + idle + alarm + offline;
    return planned > 0 ? (run / planned) * 100 : 0;
  }

  function calcPerformancePct(m) {
    const std = getStandardCycleTime(m);
    if (!std) return null;
    let runTime = m?.shiftDurations?.run_seconds || 0;
    // Add live run seconds if machine is currently running
    if (m.statusStartedAt && m.status === 'RUNNING') {
      runTime += Math.floor((Date.now() - m.statusStartedAt) / 1000);
    }
    const count = m?.tags?.count_shift || 0;
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
  function histBarColor(value, isPerf = false) {
    if (value === null)            return 'rgba(200,200,200,0.5)';
    if (isPerf && value > 100)     return 'rgba(55,138,221,0.75)';  // blue — above standard
    if (value >= 85)               return 'rgba(29,158,117,0.75)';  // green
    if (value >= 60)               return 'rgba(186,117,23,0.75)';  // amber
    return                                'rgba(163,45,45,0.75)';   // red
  }

  function buildBarColors(values, isPerf = false) {
    return values.map(v => histBarColor(v, isPerf));
  }

  function makeHistChartConfig(labels, values, title) {
    const isPerf = title === 'Performance';    
    const colors = buildBarColors(values, isPerf);


    // For performance charts, allow Y-axis to expand above 100%
    const maxVal   = values.reduce((a, v) => (v !== null && v > a ? v : a), 0);
    const yMax     = isPerf ? Math.max(100, Math.ceil(maxVal / 10) * 10 + 10) : 100;

    // Annotations: always show 85% target; show 100% reference only for performance
    const annotations = {
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
    };

    if (isPerf) {
      annotations.target100 = {
        type: 'line',
        yMin: 100, yMax: 100,
        borderColor: 'rgba(55,138,221,0.6)',
        borderWidth: 1,
        borderDash: [4, 4],
        label: {
          display: true,
          content: '100% (standard)',
          position: 'end',
          color: '#185FA5',
          font: { size: 9 }
        }
      };
    }

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
                const originals = ctx.dataset.originalValues;
                const raw = originals ? originals[ctx.dataIndex] : ctx.parsed.y;
                return raw !== null && raw !== undefined
                  ? `${Number(raw).toFixed(1)}%`
                  : 'N/A';
              }
            }
          },
          annotation: { annotations }
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 30 },
            grid:  { display: false }
          },
          y: {
            min: 0, max: yMax,
            ticks: { font: { size: 9 }, callback: v => `${v}%`, maxTicksLimit: 6 },
            grid:  { color: 'rgba(0,0,0,0.05)' }
          }
        }
      }
    };
  }

  // ── Destroy all history charts (called on dept change) ────────────────────
  function renderHistChart(canvasId, existingChart, labels, values, title) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return existingChart;
    
      if (!existingChart) {
        return new Chart(canvas, makeHistChartConfig(labels, values, title));
      }
    
      // Update in-place — never recreate the canvas
      const isPerf  = title === 'Performance';
      const colors  = buildBarColors(values, isPerf);
      const maxVal  = values.reduce((a, v) => (v !== null && v > a ? v : a), 0);
      const yMax    = isPerf ? Math.max(100, Math.ceil(maxVal / 10) * 10 + 10) : 100;

      existingChart.data.labels                              = labels;
      existingChart.data.datasets[0].data                   = values.map(v => v ?? 0);
      existingChart.data.datasets[0].backgroundColor        = colors;
      existingChart.data.datasets[0].borderColor            = colors.map(c => c.replace('0.75', '1'));
      existingChart.data.datasets[0].originalValues         = values.slice();
      existingChart.options.scales.y.max                    = yMax;
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
// --------------- HISTORY page --------------- //

// ── shared helpers ─────────────────────────────────────────────────────────
function phFmtTime(s) {
  if (!s) return '0h 0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
function phMetricColor(v, isPerf = false) {
  if (v === null || v === undefined) return '#aaa';
  if (isPerf && v > 100) return '#185FA5';
  if (v >= 85) return '#1D9E75';
  if (v >= 60) return '#BA7517';
  return '#A32D2D';
}
function phMetricClass(v) {
  if (v === null || v === undefined) return '';
  return v >= 85 ? 'ph-tbl-good' : v >= 60 ? 'ph-tbl-warn' : 'ph-tbl-bad';
}
function phAvailBar(run, idle, alarm, offline) {
  const tot = run + idle + alarm + offline || 1;
  return `<div class="ph-comp-bar">
    <div class="ph-cb-run"     style="flex:${run}"></div>
    <div class="ph-cb-idle"    style="flex:${idle}"></div>
    <div class="ph-cb-alarm"   style="flex:${alarm}"></div>
    <div class="ph-cb-offline" style="flex:${offline || 0.1}"></div>
  </div>`;
}

// ── module-level state for this page ──────────────────────────────────────
let _phSection   = 'output';   // 'output' | 'machine'
let _phMonth     = '';
let _phDept      = 'All';
let _phMachine   = 'All';
let _phPart      = 'All';
let _phMachineId = 'heat_K7';  // for machine section
let _phMode      = 'shifts';
let _phMetric    = 'avail';
let _phHistCharts = {};        // { avail, perf, oee }
let _phHistMode  = { avail: 'shifts', perf: 'shifts', oee: 'shifts' };
let _phUnsubscribe = null;
let _phTimers    = [];
const PH_MACHINES = [
  { dept: 'Press', id: 'press_AIDA630T',   label: 'AIDA 630T'  },
  { dept: 'Press', id: 'press_M-20id-25',  label: 'M-20iD/25'  },
  { dept: 'Heat',  id: 'heat_DKK1',        label: 'DKK1'        },
  { dept: 'Heat',  id: 'heat_DKK2',        label: 'DKK2'        },
  { dept: 'Heat',  id: 'heat_K3',          label: 'K3'          },
  { dept: 'Heat',  id: 'heat_K4',          label: 'K4'          },
  { dept: 'Heat',  id: 'heat_K5',          label: 'K5'          },
  { dept: 'Heat',  id: 'heat_K6',          label: 'K6'          },
  { dept: 'Heat',  id: 'heat_K7',          label: 'K7'          },
  { dept: 'Heat',  id: 'heat_K8',          label: 'K8'          },
  { dept: 'Lathe', id: 'lathe_Rotor TK1',  label: 'Rotor TK1'  },
  { dept: 'Lathe', id: 'lathe_Rotor TK4',  label: 'Rotor TK4'  },
];

export function productionProductionHistoryView() {
  // get current month as default
  const now  = new Date();
  _phMonth   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return `
  <!-- ── CSS injected once ── -->
  <style>
  .ph-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
  .ph-title{font-size:20px;font-weight:700;color:#1a1a1a}
  .ph-sub{font-size:11px;color:#aaa;margin-top:2px}
  .ph-section-tabs{display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid #e5e9f0;padding-bottom:0}
  .ph-section-tab{background:none;border:none;border-bottom:2px solid transparent;
    padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;color:#888;
    margin-bottom:-1px;transition:color .15s,border-color .15s}
  .ph-section-tab.active{color:#185FA5;border-bottom-color:#378ADD}
  .ph-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
    background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;
    padding:10px 14px;margin-bottom:12px}
  .ph-toolbar-sep{width:1px;height:22px;background:#e5e9f0;flex-shrink:0}
  .ph-lbl{font-size:10px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
  .ph-sel{font-size:12px;padding:5px 8px;border:0.5px solid #d0d7e3;
    border-radius:7px;background:#fff;color:#1a1a1a;cursor:pointer}
  .ph-sel:focus{outline:none;border-color:#378ADD}
  .ph-mode-group{display:flex;gap:3px}
  .ph-mode-btn{padding:4px 10px;font-size:11px;font-weight:600;border-radius:6px;
    border:0.5px solid #d0d7e3;background:#fff;cursor:pointer;color:#666;transition:all .12s}
  .ph-mode-btn:hover{background:#f3f6fa}
  .ph-mode-btn.ph-active{background:#E6F1FB;border-color:#378ADD;color:#185FA5}
  .ph-spacer{flex:1}
  .ph-layout{display:grid;grid-template-columns:210px 1fr;gap:12px;align-items:start}
  .ph-machine-panel{background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;overflow:hidden;position:sticky;top:0}
  .ph-machine-panel-head{padding:10px 12px 8px;border-bottom:0.5px solid #f0f0f0;background:#fafbfc}
  .ph-machine-panel-title{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.4px}
  .ph-dept-section{padding:4px 0}
  .ph-dept-head{display:flex;align-items:center;gap:6px;padding:5px 10px;
    font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;
    border-left:3px solid transparent;margin:0 4px;border-radius:0 5px 5px 0}
  .ph-dept-head.press{color:#185FA5;border-left-color:#378ADD;background:#f0f7ff}
  .ph-dept-head.heat {color:#854F0B;border-left-color:#E67E22;background:#fff8f0}
  .ph-dept-head.lathe{color:#6C3483;border-left-color:#9B59B6;background:#f9f5ff}
  .ph-machine-item{display:flex;align-items:center;gap:7px;padding:6px 10px 6px 16px;
    cursor:pointer;border-radius:6px;margin:1px 4px;transition:background .1s;
    border:0.5px solid transparent}
  .ph-machine-item:hover{background:#f3f6fa;border-color:#e5e9f0}
  .ph-machine-item.ph-selected{background:#E6F1FB;border-color:#378ADD}
  .ph-machine-item.ph-selected .ph-mi-name{color:#185FA5;font-weight:700}
  .ph-mi-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#ccc}
  .ph-mi-dot.running{background:#1D9E75} .ph-mi-dot.idle{background:#BA7517}
  .ph-mi-dot.alarm{background:#A32D2D}   .ph-mi-dot.offline{background:#888}
  .ph-mi-name{font-size:11px;font-weight:600;color:#333}
  .ph-main{display:flex;flex-direction:column;gap:10px}
  .ph-summary-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}
  .ph-sum-card{background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;padding:10px 12px}
  .ph-sum-label{font-size:10px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
  .ph-sum-val{font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.3}
  .ph-sum-sub{font-size:10px;color:#bbb;margin-top:2px}
  .ph-chart-panel{background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;padding:14px 16px}
  .ph-chart-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .ph-chart-title{font-size:13px;font-weight:700;color:#1a1a1a}
  .ph-chart-meta{font-size:11px;color:#aaa}
  .ph-chart-container{position:relative;height:220px}
  .ph-chart-container canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
  .ph-table-panel{background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;overflow:hidden}
  .ph-table-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
    padding:10px 14px;border-bottom:0.5px solid #f0f0f0;background:#fafbfc}
  .ph-table-title{font-size:12px;font-weight:700;color:#1a1a1a}
  .ph-table-wrap{overflow-x:auto;max-height:420px;overflow-y:auto}
  .ph-table-wrap::-webkit-scrollbar{width:4px;height:4px}
  .ph-table-wrap::-webkit-scrollbar-thumb{background:#d0d7e3;border-radius:2px}
  table.ph-table{width:100%;border-collapse:collapse}
  table.ph-table th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;
    color:#888;text-transform:uppercase;letter-spacing:.3px;border-bottom:0.5px solid #e5e9f0;
    background:#fafbfc;white-space:nowrap;position:sticky;top:0;z-index:1}
  table.ph-table th.r,table.ph-table td.r{text-align:right}
  table.ph-table td{padding:6px 10px;font-size:12px;border-bottom:0.5px solid #f5f5f5;white-space:nowrap}
  table.ph-table tr:last-child td{border-bottom:none}
  table.ph-table tr:hover td{background:#f7f9fc}
  .ph-shift-badge{display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:.3px}
  .ph-shift-A{background:#EAF3DE;color:#3B6D11} .ph-shift-B{background:#E6F1FB;color:#185FA5}
  .ph-shift-C{background:#F5EEF8;color:#6C3483}
  .ph-tbl-good{color:#1D9E75;font-weight:700} .ph-tbl-warn{color:#BA7517;font-weight:700}
  .ph-tbl-bad{color:#A32D2D;font-weight:700}  .ph-tbl-blue{color:#185FA5;font-weight:700}
  .ph-comp-bar{display:flex;height:7px;border-radius:4px;overflow:hidden;width:100px;gap:1px}
  .ph-cb-run{background:#1D9E75} .ph-cb-idle{background:#BA7517}
  .ph-cb-alarm{background:#A32D2D} .ph-cb-offline{background:#888}
  .ph-empty{display:flex;align-items:center;justify-content:center;height:160px;
    color:#bbb;font-size:13px;flex-direction:column;gap:6px}
  .ph-loading{display:flex;align-items:center;justify-content:center;height:100px;
    color:#aaa;font-size:12px;gap:8px}
  .ph-spinner{width:16px;height:16px;border:2px solid #e5e9f0;border-top-color:#378ADD;
    border-radius:50%;animation:ph-spin .7s linear infinite}
  @keyframes ph-spin{to{transform:rotate(360deg)}}
  .ph-hint{font-size:10px;color:#bbb;padding:4px 14px 8px;font-style:italic}
  /* output filter toolbar */
  .ph-out-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
    background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;
    padding:10px 14px;margin-bottom:12px}
  /* hist chart row */
  .ph-hist-row{display:flex;gap:10px}
  .ph-hist-wrap{flex:1;background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;padding:10px 12px}
  .ph-hist-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .ph-hist-container{position:relative;height:170px}
  .ph-hist-container canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
  .ph-hist-na{font-size:12px;color:#bbb;text-align:center;padding:40px 0}
  </style>

  <div class="ph-header">
    <div>
      <div class="ph-title">Production History</div>
      <div class="ph-sub">Output records · Machine efficiency history</div>
    </div>
  </div>

  <!-- section tabs -->
  <div class="ph-section-tabs">
    <button class="ph-section-tab ${_phSection === 'output' ? 'active' : ''}" data-tab="output">📦 Output</button>
    <button class="ph-section-tab ${_phSection === 'machine' ? 'active' : ''}" data-tab="machine">⚙️ Machine</button>
  </div>

  <!-- content placeholder -->
  <div id="ph-content"></div>
  `;
}

export async function productionProductionHistoryMount(container) {
  // destroy old chart refs on every mount
  Object.values(_phHistCharts).forEach(c => { try { c?.destroy(); } catch(e){} });
  _phHistCharts = {};
  _phHistMode   = { avail: 'shifts', perf: 'shifts', oee: 'shifts' };
  _phTimers.forEach(clearInterval);
  _phTimers = [];

  const content = container.querySelector('#ph-content');

  // ── section tab switching ─────────────────────────────────────────────
  container.querySelectorAll('.ph-section-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.ph-section-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _phSection = btn.dataset.tab;
      renderSection(content);
    });
  });

  // initial render
  await renderSection(content);

  // ── SECTION ROUTER ────────────────────────────────────────────────────
  async function renderSection(el) {
    Object.values(_phHistCharts).forEach(c => { try { c?.destroy(); } catch(e){} });
    _phHistCharts = {};
    _phTimers.forEach(clearInterval);
    _phTimers = [];
    el.innerHTML = '';

    if (_phSection === 'output') {
      await renderOutputSection(el);
    } else {
      renderMachineSection(el);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  OUTPUT SECTION
  // ══════════════════════════════════════════════════════════════════════
  async function renderOutputSection(el) {
    // build month options — current month + 11 past months
    const monthOpts = buildMonthOptions();

    el.innerHTML = `
      <!-- filter toolbar -->
      <div class="ph-out-toolbar" id="out-toolbar">
        <span class="ph-lbl">Month</span>
        <select class="ph-sel" id="out-month">${monthOpts}</select>
        <div class="ph-toolbar-sep"></div>
        <span class="ph-lbl">Dept</span>
        <select class="ph-sel" id="out-dept"><option value="All">All</option></select>
        <div class="ph-toolbar-sep"></div>
        <span class="ph-lbl">Machine</span>
        <select class="ph-sel" id="out-machine"><option value="All">All</option></select>
        <div class="ph-toolbar-sep"></div>
        <span class="ph-lbl">Part</span>
        <select class="ph-sel" id="out-part"><option value="All">All</option></select>
        <div class="ph-spacer"></div>
        <button class="ph-mode-btn ph-active" id="out-load-btn">Load</button>
      </div>

      <!-- summary strip -->
      <div id="out-summary" class="ph-summary-strip" style="display:none">
        <div class="ph-sum-card">
          <div class="ph-sum-label">Total Output</div>
          <div class="ph-sum-val" id="os-count">—</div>
          <div class="ph-sum-sub">parts (count_signal=1)</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg Cycle Time</div>
          <div class="ph-sum-val" id="os-cycle">—</div>
          <div class="ph-sum-sub">seconds / part</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg Availability</div>
          <div class="ph-sum-val" id="os-avail">—</div>
          <div class="ph-sum-sub">run / planned</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg Performance</div>
          <div class="ph-sum-val" id="os-perf">—</div>
          <div class="ph-sum-sub">std × count / run</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg OEE</div>
          <div class="ph-sum-val" id="os-oee">—</div>
          <div class="ph-sum-sub">Avail × Perf</div>
        </div>
      </div>

      <!-- table -->
      <div id="out-table-area">
        <div class="ph-empty" style="background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;height:200px">
          Select month and filters, then press <strong>Load</strong>
        </div>
      </div>
    `;

    // Load filters for current month
    await loadOutputFilters(_phMonth);

    // Bind month change → reload filters
    el.querySelector('#out-month').addEventListener('change', async e => {
      _phMonth = e.target.value;
      await loadOutputFilters(_phMonth);
    });

    el.querySelector('#out-load-btn').addEventListener('click', () => loadOutputData());

    // Auto-load on first render
    loadOutputData();
  }

  function buildMonthOptions() {
    const opts = [];
    const now  = new Date();
    for (let i = 0; i < 12; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      opts.push(`<option value="${val}" ${val === _phMonth ? 'selected' : ''}>${lbl}</option>`);
    }
    return opts.join('');
  }

  async function loadOutputFilters(month) {
    try {
      const res  = await fetch(`/api/production-output/filters?month=${month}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success) return;

      const deptSel    = document.getElementById('out-dept');
      const machineSel = document.getElementById('out-machine');
      const partSel    = document.getElementById('out-part');
      if (!deptSel) return;

      const prevDept    = deptSel.value;
      const prevMachine = machineSel.value;
      const prevPart    = partSel.value;

      deptSel.innerHTML    = `<option value="All">All</option>` + data.departments.map(d => `<option value="${d}" ${d === prevDept ? 'selected' : ''}>${d}</option>`).join('');
      machineSel.innerHTML = `<option value="All">All</option>` + data.machines.map(m => `<option value="${m}" ${m === prevMachine ? 'selected' : ''}>${m}</option>`).join('');
      partSel.innerHTML    = `<option value="All">All</option>` + data.parts.map(p => `<option value="${p}" ${p === prevPart ? 'selected' : ''}>${p}</option>`).join('');
    } catch (e) {
      console.error('loadOutputFilters error:', e);
    }
  }

  async function loadOutputData() {
    const month   = document.getElementById('out-month')?.value   || _phMonth;
    const dept    = document.getElementById('out-dept')?.value    || 'All';
    const machine = document.getElementById('out-machine')?.value || 'All';
    const part    = document.getElementById('out-part')?.value    || 'All';

    const area = document.getElementById('out-table-area');
    if (!area) return;
    area.innerHTML = `<div class="ph-loading"><div class="ph-spinner"></div>Loading…</div>`;

    const params = new URLSearchParams({ month });
    if (dept    !== 'All') params.set('dept',    dept);
    if (machine !== 'All') params.set('machine', machine);
    if (part    !== 'All') params.set('part',    part);

    try {
      const res  = await fetch(`/api/production-output?${params}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success || !data.rows.length) {
        area.innerHTML = `<div class="ph-empty" style="background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;height:180px">No data for selected filters</div>`;
        document.getElementById('out-summary')?.style.setProperty('display', 'none');
        return;
      }
      renderOutputTable(area, data.rows);
    } catch (e) {
      area.innerHTML = `<div class="ph-empty" style="background:#fff;border:0.5px solid #e5e9f0;border-radius:10px;height:180px">Error loading data</div>`;
    }
  }

  function renderOutputTable(area, rows) {
    // summary
    const sumEl = document.getElementById('out-summary');
    if (sumEl) {
      sumEl.style.display = '';
      const totalCount = rows.reduce((a, r) => a + r.count_output, 0);
      const cycles     = rows.filter(r => r.avg_cycle_time).map(r => r.avg_cycle_time);
      const avgCycle   = cycles.length ? (cycles.reduce((a, b) => a + b, 0) / cycles.length).toFixed(1) : null;
      const avails     = rows.filter(r => r.avail !== null).map(r => r.avail);
      const avgAvail   = avails.length ? (avails.reduce((a, b) => a + b, 0) / avails.length).toFixed(1) : null;
      const perfs      = rows.filter(r => r.perf !== null).map(r => r.perf);
      const avgPerf    = perfs.length ? (perfs.reduce((a, b) => a + b, 0) / perfs.length).toFixed(1) : null;
      const oees       = rows.filter(r => r.oee !== null).map(r => r.oee);
      const avgOee     = oees.length ? (oees.reduce((a, b) => a + b, 0) / oees.length).toFixed(1) : null;

      document.getElementById('os-count').textContent = totalCount.toLocaleString();
      document.getElementById('os-cycle').textContent = avgCycle ? `${avgCycle} s` : '—';
      const av = document.getElementById('os-avail');
      av.textContent = avgAvail ? `${avgAvail}%` : '—';
      av.style.color = avgAvail ? phMetricColor(parseFloat(avgAvail)) : '#aaa';
      const pf = document.getElementById('os-perf');
      pf.textContent = avgPerf ? `${avgPerf}%` : '—';
      pf.style.color = avgPerf ? phMetricColor(parseFloat(avgPerf), true) : '#aaa';
      const oe = document.getElementById('os-oee');
      oe.textContent = avgOee ? `${avgOee}%` : '—';
      oe.style.color = avgOee ? phMetricColor(parseFloat(avgOee)) : '#aaa';
    }

    // table
    area.innerHTML = `
      <div class="ph-table-panel">
        <div class="ph-table-head">
          <span class="ph-table-title">Output detail</span>
          <span style="font-size:10px;color:#bbb">${rows.length} rows</span>
        </div>
        <div class="ph-table-wrap">
          <table class="ph-table">
            <thead><tr>
              <th>Date</th>
              <th>Dept</th>
              <th>Machine</th>
              <th>Part name</th>
              <th class="r">Count</th>
              <th class="r">Avg cycle</th>
              <th class="r">Availability</th>
              <th class="r">Performance</th>
              <th class="r">OEE</th>
              <th>Status split</th>
              <th class="r">Run time</th>
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const d  = new Date(r.date + 'T00:00:00');
                const dl = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const deptColor = { Press: '#185FA5', Heat: '#854F0B', Lathe: '#6C3483' }[r.department] || '#888';
                return `<tr>
                  <td>${dl}</td>
                  <td><span style="font-size:10px;font-weight:600;color:${deptColor}">${r.department}</span></td>
                  <td style="font-weight:600">${r.machine}</td>
                  <td>${r.part_name || '<span style="color:#bbb">—</span>'}</td>
                  <td class="r" style="font-weight:700">${r.count_output.toLocaleString()}</td>
                  <td class="r">${r.avg_cycle_time != null ? r.avg_cycle_time + ' s' : '—'}</td>
                  <td class="r ${r.avail !== null ? phMetricClass(r.avail) : ''}">${r.avail !== null ? r.avail + '%' : '—'}</td>
                  <td class="r ${r.perf !== null ? (r.perf > 100 ? 'ph-tbl-blue' : phMetricClass(r.perf)) : ''}">${r.perf !== null ? r.perf + '%' : '—'}</td>
                  <td class="r ${r.oee !== null ? phMetricClass(r.oee) : ''}">${r.oee !== null ? r.oee + '%' : '—'}</td>
                  <td>${phAvailBar(r.run_seconds, r.idle_seconds, r.alarm_seconds, r.offline_seconds)}</td>
                  <td class="r">${phFmtTime(r.run_seconds)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="ph-hint">Green ≥85% · Amber ≥60% · Red &lt;60% · Blue = Performance above standard · Availability shared across all parts on same machine/day</div>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MACHINE SECTION
  // ══════════════════════════════════════════════════════════════════════
  function renderMachineSection(el) {
    el.innerHTML = `
      <!-- toolbar: period + metric selector -->
      <div class="ph-toolbar">
        <span class="ph-lbl">Period</span>
        <div class="ph-mode-group">
          <button class="ph-mode-btn ${_phMode === 'shifts'  ? 'ph-active' : ''}" data-mode="shifts">Shifts</button>
          <button class="ph-mode-btn ${_phMode === 'days'    ? 'ph-active' : ''}" data-mode="days">Days</button>
          <button class="ph-mode-btn ${_phMode === 'months'  ? 'ph-active' : ''}" data-mode="months">Months</button>
        </div>
        <div class="ph-toolbar-sep"></div>
        <span class="ph-lbl">Metric</span>
        <div class="ph-mode-group">
          <button class="ph-mode-btn ${_phMetric === 'avail' ? 'ph-active' : ''}" data-metric="avail">Availability</button>
          <button class="ph-mode-btn ${_phMetric === 'perf'  ? 'ph-active' : ''}" data-metric="perf">Performance</button>
          <button class="ph-mode-btn ${_phMetric === 'oee'   ? 'ph-active' : ''}" data-metric="oee">OEE</button>
          <button class="ph-mode-btn ${_phMetric === 'count' ? 'ph-active' : ''}" data-metric="count">Output</button>
        </div>
      </div>

      <!-- two-column layout -->
      <div class="ph-layout">
        <!-- machine list -->
        <div class="ph-machine-panel">
          <div class="ph-machine-panel-head">
            <div class="ph-machine-panel-title">Machines</div>
          </div>
          ${['Press', 'Heat', 'Lathe'].map(dept => {
            const list = PH_MACHINES.filter(m => m.dept === dept);
            const cls  = dept.toLowerCase();
            return `<div class="ph-dept-section">
              <div class="ph-dept-head ${cls}">${dept}</div>
              ${list.map(m => {
                const st = (scadaStore.state.machines[m.id]?.status || 'offline').toLowerCase();
                return `<div class="ph-machine-item ${m.id === _phMachineId ? 'ph-selected' : ''}" data-mid="${m.id}">
                  <span class="ph-mi-dot ${st}"></span>
                  <span class="ph-mi-name">${m.label}</span>
                </div>`;
              }).join('')}
            </div>`;
          }).join('')}
        </div>

        <!-- main panel -->
        <div class="ph-main" id="ph-mc-main">
          <div class="ph-loading"><div class="ph-spinner"></div>Loading…</div>
        </div>
      </div>
    `;

    // bind toolbar
    el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      _phMode = b.dataset.mode;
      el.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('ph-active', x.dataset.mode === _phMode));
      loadMachineData();
    }));

    el.querySelectorAll('[data-metric]').forEach(b => b.addEventListener('click', () => {
      _phMetric = b.dataset.metric;
      el.querySelectorAll('[data-metric]').forEach(x => x.classList.toggle('ph-active', x.dataset.metric === _phMetric));
      loadMachineData();
    }));

    el.querySelectorAll('[data-mid]').forEach(b => b.addEventListener('click', () => {
      _phMachineId = b.dataset.mid;
      el.querySelectorAll('[data-mid]').forEach(x => x.classList.toggle('ph-selected', x.dataset.mid === _phMachineId));
      el.querySelectorAll('.ph-machine-item.ph-selected .ph-mi-name').forEach(x => x.style.color = '#185FA5');
      loadMachineData();
    }));

    // subscribe to live status dots
    _phUnsubscribe = scadaStore.subscribe(state => {
      PH_MACHINES.forEach(m => {
        const dot = el.querySelector(`[data-mid="${m.id}"] .ph-mi-dot`);
        if (dot) {
          const st = (state.machines[m.id]?.status || 'offline').toLowerCase();
          dot.className = `ph-mi-dot ${st}`;
        }
      });
    });

    loadMachineData();
  }

  async function loadMachineData() {
    const main = document.getElementById('ph-mc-main');
    if (!main) return;
    main.innerHTML = `<div class="ph-loading"><div class="ph-spinner"></div>Loading…</div>`;

    const [dept, ...mp] = _phMachineId.split('_');
    const machine = mp.join('_');
    const machineObj = PH_MACHINES.find(m => m.id === _phMachineId);

    try {
      const res  = await fetch(`/api/machine-history?dept=${dept}&machine=${encodeURIComponent(machine)}&mode=${_phMode}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success) throw new Error('API error');
      renderMachineMain(main, data, machineObj);
    } catch (e) {
      main.innerHTML = `<div class="ph-empty" style="background:#fff;border:0.5px solid #e5e9f0;border-radius:10px">Error loading data</div>`;
    }
  }

  function renderMachineMain(main, data, machineObj) {
    const rows = data.data;
    const std  = data.std_cycle_time;
    const periodLabel = { shifts: 'last 31 shifts', days: 'last 31 days', months: 'last 12 months' }[_phMode];

    if (!rows.length) {
      main.innerHTML = `<div class="ph-empty" style="background:#fff;border:0.5px solid #e5e9f0;border-radius:10px">No data for this machine / period</div>`;
      return;
    }

    // summary
    const totCount   = rows.reduce((a, r) => a + (r.count_output || 0), 0);
    const totRun     = rows.reduce((a, r) => a + (r.run_seconds  || 0), 0);
    const avgAvail   = rows.filter(r => r.avail !== null).reduce((a, r) => a + r.avail, 0) / (rows.filter(r => r.avail !== null).length || 1);
    const avgPerf    = rows.filter(r => r.perf  !== null).reduce((a, r) => a + r.perf,  0) / (rows.filter(r => r.perf  !== null).length || 1);
    const avgOee     = rows.filter(r => r.oee   !== null).reduce((a, r) => a + r.oee,   0) / (rows.filter(r => r.oee   !== null).length || 1);
    const isPerf     = _phMetric === 'perf';
    const isCount    = _phMetric === 'count';

    main.innerHTML = `
      <!-- summary strip -->
      <div class="ph-summary-strip">
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg Availability</div>
          <div class="ph-sum-val" style="color:${phMetricColor(avgAvail)}">${avgAvail.toFixed(1)}%</div>
          <div class="ph-sum-sub">${periodLabel}</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg Performance</div>
          <div class="ph-sum-val" style="color:${phMetricColor(avgPerf, true)}">${std ? avgPerf.toFixed(1) + '%' : 'N/A'}</div>
          <div class="ph-sum-sub">${std ? 'std ' + std + ' s' : 'no standard set'}</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Avg OEE</div>
          <div class="ph-sum-val" style="color:${phMetricColor(avgOee)}">${std ? avgOee.toFixed(1) + '%' : 'N/A'}</div>
          <div class="ph-sum-sub">Avail × Perf</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Total Output</div>
          <div class="ph-sum-val">${totCount.toLocaleString()}</div>
          <div class="ph-sum-sub">parts produced</div>
        </div>
        <div class="ph-sum-card">
          <div class="ph-sum-label">Total Run Time</div>
          <div class="ph-sum-val" style="font-size:15px">${phFmtTime(totRun)}</div>
          <div class="ph-sum-sub">machine running</div>
        </div>
      </div>

      <!-- trend chart -->
      <div class="ph-chart-panel">
        <div class="ph-chart-header">
          <span class="ph-chart-title">${{ avail: 'Availability', perf: 'Performance', oee: 'OEE', count: 'Output count' }[_phMetric]} — ${machineObj?.label ?? _phMachineId}</span>
          <span class="ph-chart-meta">${periodLabel}</span>
        </div>
        <div class="ph-chart-container"><canvas id="ph-main-chart"></canvas></div>
      </div>

      <!-- history charts row -->
      <div class="ph-hist-row">
        <div class="ph-hist-wrap">
          <div class="ph-hist-header">
            <span class="ph-chart-title" style="font-size:12px">Availability history</span>
            <select id="ph-hist-avail-mode" class="ph-sel" style="font-size:10px;padding:3px 6px">
              <option value="shifts">31 shifts</option><option value="days">31 days</option><option value="months">12 months</option>
            </select>
          </div>
          <div class="ph-hist-container"><canvas id="ph-hist-avail"></canvas></div>
        </div>
        <div class="ph-hist-wrap">
          <div class="ph-hist-header">
            <span class="ph-chart-title" style="font-size:12px">Performance history</span>
            <select id="ph-hist-perf-mode" class="ph-sel" style="font-size:10px;padding:3px 6px">
              <option value="shifts">31 shifts</option><option value="days">31 days</option><option value="months">12 months</option>
            </select>
          </div>
          <div class="ph-hist-container"><canvas id="ph-hist-perf"></canvas></div>
          <div id="ph-perf-na" class="ph-hist-na" style="display:none">No standard cycle time</div>
        </div>
        <div class="ph-hist-wrap">
          <div class="ph-hist-header">
            <span class="ph-chart-title" style="font-size:12px">OEE history</span>
            <select id="ph-hist-oee-mode" class="ph-sel" style="font-size:10px;padding:3px 6px">
              <option value="shifts">31 shifts</option><option value="days">31 days</option><option value="months">12 months</option>
            </select>
          </div>
          <div class="ph-hist-container"><canvas id="ph-hist-oee"></canvas></div>
          <div id="ph-oee-na" class="ph-hist-na" style="display:none">No standard cycle time</div>
        </div>
      </div>

      <!-- data table -->
      <div class="ph-table-panel">
        <div class="ph-table-head">
          <span class="ph-table-title">Detail — ${machineObj?.label ?? _phMachineId}</span>
          <span style="font-size:10px;color:#bbb">${rows.length} records</span>
        </div>
        <div class="ph-table-wrap">
          <table class="ph-table">
            <thead><tr>
              <th>Period</th>
              ${_phMode === 'shifts' ? '<th>Shift</th>' : ''}
              <th class="r">Availability</th>
              <th class="r">Performance</th>
              <th class="r">OEE</th>
              <th class="r">Output</th>
              <th>Status split</th>
              <th class="r">Run time</th>
            </tr></thead>
            <tbody>
              ${[...rows].reverse().map(r => {
                const dateLabel = _phMode === 'shifts'
                  ? r.label.split(' ').slice(1).join(' ')
                  : r.label;
                return `<tr>
                  <td>${dateLabel}</td>
                  ${_phMode === 'shifts' ? `<td><span class="ph-shift-badge ph-shift-${r.label[0]}">${r.label[0]}</span></td>` : ''}
                  <td class="r ${r.avail !== null ? phMetricClass(r.avail) : ''}">${r.avail !== null ? r.avail + '%' : '—'}</td>
                  <td class="r ${r.perf  !== null ? (r.perf > 100 ? 'ph-tbl-blue' : phMetricClass(r.perf)) : ''}">${r.perf !== null ? r.perf + '%' : '—'}</td>
                  <td class="r ${r.oee   !== null ? phMetricClass(r.oee)   : ''}">${r.oee  !== null ? r.oee  + '%' : '—'}</td>
                  <td class="r" style="font-weight:600">${(r.count_output || 0).toLocaleString()}</td>
                  <td>${phAvailBar(r.run_seconds || 0, 0, 0, 0)}</td>
                  <td class="r">${phFmtTime(r.run_seconds)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="ph-hint">Green ≥85% · Amber ≥60% · Red &lt;60% · Blue = Performance above standard</div>
      </div>
    `;

    // draw main chart
    drawPhBarChart('ph-main-chart', rows.map(r => r.label), rows.map(r => r[_phMetric]), _phMetric, std);

    // draw history charts (same data, just different initial render)
    drawHistChart('ph-hist-avail', rows.map(r => r.label), rows.map(r => r.avail), 'avail', std, 'ph-avail-na');
    drawHistChart('ph-hist-perf',  rows.map(r => r.label), rows.map(r => r.perf),  'perf',  std, 'ph-perf-na');
    drawHistChart('ph-hist-oee',   rows.map(r => r.label), rows.map(r => r.oee),   'oee',   std, 'ph-oee-na');

    // history mode selectors
    ['avail', 'perf', 'oee'].forEach(key => {
      document.getElementById(`ph-hist-${key}-mode`)?.addEventListener('change', async e => {
        _phHistMode[key] = e.target.value;
        const [d2, ...m2] = _phMachineId.split('_');
        const machine2 = m2.join('_');
        const r2 = await fetch(`/api/machine-history?dept=${d2}&machine=${encodeURIComponent(machine2)}&mode=${_phHistMode[key]}`, { credentials: 'same-origin' });
        const d3 = await r2.json();
        if (d3.success) {
          if (_phHistCharts[key]) { _phHistCharts[key].destroy(); _phHistCharts[key] = null; }
          drawHistChart(`ph-hist-${key}`, d3.data.map(r => r.label), d3.data.map(r => r[key]), key, d3.std_cycle_time, `ph-${key}-na`);
        }
      });
    });
  }

  // ── chart helpers ──────────────────────────────────────────────────────
  function barColors(values, metric) {
    return values.map(v => {
      if (v === null) return 'rgba(200,200,200,0.5)';
      if (metric === 'count') return 'rgba(55,138,221,0.75)';
      if (metric === 'perf' && v > 100) return 'rgba(55,138,221,0.75)';
      if (v >= 85) return 'rgba(29,158,117,0.75)';
      if (v >= 60) return 'rgba(186,117,23,0.75)';
      return 'rgba(163,45,45,0.75)';
    });
  }

  function drawPhBarChart(canvasId, labels, values, metric, std) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const isCount = metric === 'count';
    const isPerf  = metric === 'perf';
    const colors  = barColors(values, metric);
    const maxVal  = values.reduce((a, v) => v !== null && v > a ? v : a, 0);
    const yMax    = isCount ? Math.ceil(maxVal * 1.15 / 10) * 10 || 100
                            : isPerf ? Math.max(100, Math.ceil(maxVal / 10) * 10 + 10) : 100;
    const annotations = {};
    if (!isCount) {
      annotations.t85 = { type: 'line', yMin: 85, yMax: 85, borderColor: 'rgba(29,158,117,0.5)', borderWidth: 1, borderDash: [4, 4], label: { display: true, content: '85%', position: 'end', color: '#1D9E75', font: { size: 9 } } };
      if (isPerf && std) annotations.t100 = { type: 'line', yMin: 100, yMax: 100, borderColor: 'rgba(55,138,221,0.5)', borderWidth: 1, borderDash: [4, 4], label: { display: true, content: '100%', position: 'end', color: '#185FA5', font: { size: 9 } } };
    }
    return new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: values.map(v => v ?? 0), backgroundColor: colors, borderColor: colors.map(c => c.replace('0.75', '1')), borderWidth: 1, borderRadius: 3, originalValues: values.slice() }] },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => { const raw = ctx.dataset.originalValues[ctx.dataIndex]; return raw !== null ? isCount ? raw.toLocaleString() : raw.toFixed(1) + '%' : 'N/A'; } } }, annotation: { annotations } },
        scales: { x: { ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 30 }, grid: { display: false } }, y: { min: 0, max: yMax, ticks: { font: { size: 9 }, callback: v => isCount ? v.toLocaleString() : `${v}%`, maxTicksLimit: 6 }, grid: { color: 'rgba(0,0,0,0.05)' } } }
      }
    });
  }

  function drawHistChart(canvasId, labels, values, metric, std, naId) {
    const canvas = document.getElementById(canvasId);
    const naEl   = document.getElementById(naId);
    if (!canvas) return;
    const hasVal = values.some(v => v !== null);
    if (!hasVal || (metric !== 'avail' && !std)) {
      if (canvas) canvas.style.display = 'none';
      if (naEl)   naEl.style.display   = '';
      return;
    }
    if (canvas) canvas.style.display = '';
    if (naEl)   naEl.style.display   = 'none';
    if (_phHistCharts[metric]) { try { _phHistCharts[metric].destroy(); } catch(e){} }
    _phHistCharts[metric] = drawPhBarChart(canvasId, labels, values, metric, std);
  }
}

export function productionProductionHistoryUnmount() {
  if (_phUnsubscribe) { _phUnsubscribe(); _phUnsubscribe = null; }
  Object.values(_phHistCharts).forEach(c => { try { c?.destroy(); } catch(e){} });
  _phHistCharts = {};
  _phTimers.forEach(clearInterval);
  _phTimers = [];
}
// --------------- STAFF MANAGEMENT page --------------- //
export function productionStaffManagementView() {
  return `<h1>👨‍👨‍👦‍ Staff Management</h1><div class="card"><p>Waiting for development</p></div>`;
}
