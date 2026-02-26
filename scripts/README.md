### main.css
```css
/* frontend/public/css/main.css */ /* for show count */
.machine-shift-grid {
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 6px;
  margin-top: 8px;
}
.shift-box {
  background: rgba(0,0,0,0.04);
  padding: 6px 8px;
  border-radius: 6px;
  text-align: center;
  font-size: 12px;
}
.shift-label {
  opacity: 0.7;
  margin-bottom: 2px;
}
.shift-value {
  font-weight: 600;
}
```

### app.js
```javaScript
// frontend/public/js/app.js
import { renderSidebar } from './sidebar.js';
import { initSidebarBehavior,setActiveSidebar } from './sidebar-behavior.js';
import { routes } from './routes.js';
import { scadaStore } from './store.js';

let currentUnmount = null;
let currentUserRole = null;
window.scadaStore = scadaStore; // 👈 debug only

// Auth check
async function checkAuth() {
  const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
  const auth = await res.json();
  if (!auth.authenticated) {
    window.location.href = '/login.html';
    return false;
  }
  currentUserRole = auth.role;
  return true;
}

function mountTopbar() {
  const btn = document.getElementById('logout-btn');
  const roleEl = document.getElementById('user-role');

  if (roleEl) roleEl.textContent = currentUserRole;

  if (btn) {
    btn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      window.location.href = '/login.html';
    });
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { 
    method: 'POST', 
    credentials: 'same-origin' 
  });
  window.location.href = '/login.html';
}
let localTimer = null;

function startLocalTicker() {

  if (localTimer) return; // prevent multiple timers

  localTimer = setInterval(() => {

    Object.values(scadaStore.state.machines).forEach(machine => {

      if (!machine.status) return;

      const bucketMap = {
        RUNNING: 'run_seconds',
        IDLE: 'idle_seconds',
        ALARM: 'alarm_seconds',
        OFFLINE: 'offline_seconds'
      };

      const bucket = bucketMap[machine.status];
      if (!bucket) return;

      machine.shiftDurations[bucket] += 1;

    });

  }, 1000);
}

function initWebSocket() {
  if (scadaStore.ws) return;

  // const ws = new WebSocket('ws://localhost:3000');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}`);

  scadaStore.ws = ws;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'plc_snapshot') {
      scadaStore.setSnapshot(msg.payload);
      startLocalTicker();
    }


    if (msg.type === 'plc_update') {
      scadaStore.applyUpdate(msg.payload);
    }

    if (msg.type === 'plc_clean') {
      scadaStore.applyPlcClean(msg.payload);
    }
  };

  ws.onopen = () => console.log('WS connected');
  ws.onclose = () => {
    console.log('WS disconnected');
    setTimeout(initWebSocket, 2000); // auto-reconnect
  };
}

function mountSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = renderSidebar(currentUserRole);
  initSidebarBehavior(navigate);

}

function initSidebarToggle() {
  const layout = document.querySelector('.layout');

  // IMPORTANT: button is inside sidebar
  const btn = document.getElementById('toggleSidebar');
  const icon = document.getElementById('toggleIcon');
  if (!btn || !layout) return;

  const updateIcon = () => {
    if (layout.classList.contains('sidebar-collapsed')) {
      icon.classList.remove('fa-angles-left');
      icon.classList.add('fa-angles-right');
    } else {
      icon.classList.remove('fa-angles-right');
      icon.classList.add('fa-angles-left');
    }
  };

  btn.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');
    updateIcon();

    localStorage.setItem(
      'sidebar-collapsed',
      layout.classList.contains('sidebar-collapsed')
    );
  });

  // Restore state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
  }
  
  // Set initial icon
  updateIcon();
}

function startClock() {
  const clockEl = document.getElementById('digital-clock');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();

    const date = now.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const time = now.toLocaleTimeString();

    clockEl.textContent = `${date} | ${time}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
}


export async function navigate(route) {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  if (currentUnmount) currentUnmount();

  const app = document.getElementById('app');
  app.className = 'page';

  const parts = route.split('.');
  let node = routes;

  for (const part of parts) {
    node = node?.[part];
  }

  if (!node) {
    console.warn('Route not found:', route);
    return;
  }

  // Role guard
  if (node.role && node.role !== currentUserRole) {
    alert('Access denied');
    return;
  }

  // Page wrapper class
  app.classList.add(`page-${parts[0]}`);

  // Clear page
  app.innerHTML = '';

  // Render static HTML if provided
  if (node.view) {
    app.innerHTML = node.view();
  }

  // Mount dynamic logic (WS, subscriptions, DOM updates)
  node.mount?.(app);

  currentUnmount = node.unmount || null;

  // Sync sidebar
  setActiveSidebar(route);
}


function handleHashNavigation() {
  const hash = window.location.hash.slice(1); // drop '#'
  if (!hash) return;

  const [path] = hash.split('?');
  const route = path.replace(/\//g, '.');
  if (route) navigate(route);
}

async function bootstrap() {
  const ok = await checkAuth();
  if (!ok) return;

  initWebSocket();
  mountTopbar();
  mountSidebar();        // injects sidebar HTML
  initSidebarToggle();   // now button exists

  // if user landed with a hash, navigate there; otherwise go home
  if (window.location.hash) {
    handleHashNavigation();
  } else {
    navigate('home');
  }

  startClock();
}

// respond when something else (like a card click) updates the hash
window.addEventListener('hashchange', handleHashNavigation);

bootstrap();

```

### production.js 
```javaScript
// frontend/public/js/views/production.js 
import { scadaStore } from '../store.js'; 
import { formatDuration } from '../utils.js';
const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding']; 


// --------------- GLOBALS functions --------------- //
function calculateShiftSummary() { 
    const machines = Object.values(scadaStore.state.machines); 

    let totalRun = 0; 
    let totalIdle = 0; 
    let totalAlarm = 0; 

    machines.forEach(m => {
        if (!m.shiftDurations) return; 
            totalRun += m.shiftDurations.run_seconds || 0; 
            totalIdle += m.shiftDurations.idle_seconds || 0; 
            totalAlarm += m.shiftDurations.alarm_seconds || 0; 
        }); 

    const planned = totalRun + totalIdle + totalAlarm;
    const availability = planned ? (totalRun / planned) * 100 : 0;

    return { 
        availability: availability,
        totalRun,
        totalIdle,
        totalAlarm
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


// ---------------- Overview Page ---------------- // 
let unsubscribe = null; 
export function productionOverviewMount(container) {
    const plantId = 'plant1'; 
    const cardMap = new Map(); // machineId → DOM element 
        let initialized = false; 
    container.innerHTML = `
        <h1>🏭 Production Overview</h1> 
        <section id="shift-summary" class="shift-summary"></section> 
        <section id="machine-grid" class="machine-grid"></section> 
    `;
    const grid = container.querySelector('#machine-grid');
    const summaryEl = container.querySelector('#shift-summary');

    function statusClass(machine) {
        if (machine.status === 'OFFLINE') return 'offline'; 
        if (machine.alarms?.length) return 'alarm'; 
        return machine.status?.toLowerCase() || 'idle'; 
    }

    // why count shift don't show in overview?
    unsubscribe = scadaStore.subscribe(state => {
        const machines = Object.entries(state.machines); 
        const groups = {}; 
        const summary = calculateShiftSummary(state); 
        
        summaryEl.innerHTML =`
            <div class="summary-grid"> 
                <div class="summary-box"> 
                    Availability 
                    <span class="${kpiClass(summary.availability)}"> ${summary.availability.toFixed(1)}% </span> 
                </div> 
                <div class="summary-box"> 
                    Run 
                    <span>${formatTime(summary.totalRun)}</span> 
                </div> 
                <div class="summary-box"> 
                    Idle 
                    <span>${formatTime(summary.totalIdle)}</span> 
                </div> 
                <div class="summary-box"> 
                    Alarm 
                    <span>${formatTime(summary.totalAlarm)}</span> 
                </div> 
            </div> 
            `; 
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
        } 
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

    function createMachineCard(id, m) {
        const card = document.createElement('div'); 
        card.className = `machine-card ${statusClass(m)}`; 
        
        card.addEventListener('click', () => {
            const [dept, machine] = id.split('_'); 
            window.location.hash = `#production/machine_efficiency?dept=${dept}&machine=${machine}`; 
        }); 
        updateMachineCard(card, id, m); 
        return card; 
    } 

    function updateMachineCard(card, id, m) {
        card.className = `machine-card ${statusClass(m)}`; 
        card.innerHTML = `
            <div class="machine-header"> 
                <div class="machine-name"> 
                    <span class="dot ${m.status?.toLowerCase()}"></span> 
                    ${id.split('_')[1]} 
                </div> 
                <span class="status-badge ${m.status?.toLowerCase()}"> ${m.status ?? '--'} </span> 
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
                    <div class="kpi-label">Cycle Time</div> 
                    <div class="kpi-value"> 
                        ${m.tags?.cycle_time ?? '--'} s 
                    </div>
                </div> 
                <div class="kpi-box"> 
                    <div class="kpi-label">Count</div> 
                    <div class="kpi-value"> 
                        ${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'} 
                    </div> 
                </div> 
            </div> 
            
            <!-- SHIFT DURATIONS -->
            <div class="machine-shift-grid">
                <div class="shift-box">
                    <div class="shift-label">Run</div>
                    <div class="shift-value">${formatDuration(
                        m.shiftDurations?.run_seconds || 0,
                        m.status === 'RUNNING' ? m.statusStartedAt : null
                    )}</div>
                </div>
                <div class="shift-box">
                    <div class="shift-label">Idle</div>
                    <div class="shift-value">${formatDuration(
                        m.shiftDurations?.idle_seconds || 0,
                        m.status === 'IDLE' ? m.statusStartedAt : null
                    )}</div>
                </div>
                <div class="shift-box">
                    <div class="shift-label">Alarm</div>
                    <div class="shift-value">${formatDuration(
                        m.shiftDurations?.alarm_seconds || 0,
                        m.status === 'ALARM' ? m.statusStartedAt : null
                    )}</div>
                </div>
                <div class="shift-box">
                    <div class="shift-label">Offline</div>
                    <div class="shift-value">${formatDuration(
                        m.shiftDurations?.offline_seconds || 0,
                        m.status === 'OFFLINE' ? m.statusStartedAt : null
                    )}</div>
                </div>
            </div>
            
            <div class="machine-footer"> 
                ⏱ ${ 
                m.timestamp 
                ? new Date(m.timestamp).toLocaleTimeString() 
                : '--' 
                } 
            </div> 
        `; 
    } 
} 
export function productionOverviewUnmount() {
 if (unsubscribe) unsubscribe(); 
}


// --------------- Machine Efficiency page --------------- //
let efficiencyUnsubscribe = null; 
let stopwatchInterval = null; 

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
    <section id="selected-machine-card"> </section> 
    <section id="chart-container"> 
        <canvas id="cycleChart"></canvas> 
    </section> 
    `; 
}
export function productionMachineEfficiencyMount(container) { 
    const deptSelect = container.querySelector('#dept-select'); 
    const machineSelect = container.querySelector('#machine-select'); 
    const cardContainer = container.querySelector('#selected-machine-card');

    let selectedId = null; // 🔥 track current machine 
    let chart = null;
    let deepLinkApplied = false;
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

    stopwatchInterval = setInterval(() => {
        const now = Date.now(); 
        Object.entries(scadaStore.state.machines) 
        .forEach(([id, m]) => {
            if (!m.shiftDurations) return;
             const diff = Math.floor( 
                (now - m.statusStartedAt) / 1000 
            ); 
            
            const bucketMap = { 
                RUNNING: 'run_seconds', 
                IDLE: 'idle_seconds', 
                ALARM: 'alarm_seconds', 
                OFFLINE: 'offline_seconds' 
            }; 
            const bucket = bucketMap[m.status];
            const base = m.shiftDurations[bucket] ?? 0;
            const total = base + diff; 
            // update DOM text 
        }); 
    }, 1000); 
    
    function calculateAvailability(m) {
         if (!m?.shiftDurations) return null;
         const {
            run_seconds = 0, 
            idle_seconds = 0, 
            alarm_seconds = 0 
        } = m.shiftDurations;

        const planned = run_seconds + idle_seconds + alarm_seconds; 
        if (planned === 0) return 0; 
            return ((run_seconds / planned) * 100); 
    }

    function availabilityClass(value) {
        if (value >= 85) return 'kpi-good'; 
        if (value >= 60) return 'kpi-warning'; 
        return 'kpi-bad'; 
    } 
    
    function calculatePerformance(m) {
        if (!m?.shiftDurations) return null; 
        const runTime = m.shiftDurations.run_seconds; 
        const idealCT = m.standard_cycle_time; 
        const totalCount = m.tags?.count_shift ?? 0; 
        if (!runTime || !idealCT) return 0; 
        const performance = (idealCT * totalCount) / runTime * 100; 
        return Math.min(performance, 999); // avoid crazy % 
    } 
    
    function calculateOEE(m) { 
        const availability = calculateAvailability(m); 
        const performance = calculatePerformance(m); 
        if (availability == null || performance == null) return null;
        return (availability / 100) * (performance / 100) * 100; 
    } 

    function renderMachineCard(id, m) {
        if (!m) return;
        const availability = calculateAvailability(m); 
        const performance = calculatePerformance(m); 
        const oee = calculateOEE(m); 
        const aVal = availability?.toFixed(1) ?? '--'; 
        const pVal = performance?.toFixed(1) ?? '--'; 
        const oVal = oee?.toFixed(1) ?? '--'; 
        cardContainer.innerHTML = `
            <div class="machine-card large ${m.status?.toLowerCase()}"> 
                <div class="machine-header"> 
                    <h2>${id.split('_')[1]}</h2> 
                    <span class="shift-label">Shift ${m.shift ?? '--'}</span> 
                </div> <div class="kpi-row-eff"> 
                <div class="kpi-box-eff"> 
                    <div class="kpi-label-eff">Availability</div> 
                    <div class="kpi-value-eff ${kpiClass(availability)}">${aVal}%</div> 
                </div> 
                <div class="kpi-box-eff"> 
                    <div class="kpi-label-eff">Performance</div> 
                        <div class="kpi-value-eff ${kpiClass(performance)}">${pVal}%</div> </div> <div class="kpi-box-eff"> 
                            <div class="kpi-label-eff">OEE</div> <div class="kpi-value-eff ${kpiClass(oee)}">${oVal}%</div> 
                        </div> 
                    </div> 
                </div> 
                `; 
        const history = m.cycleHistory ?? []; 
        const labels = history.map(p => 
            new Date(p.t).toLocaleTimeString() 
        ); 
        const values = history.map(p => p.v); 
        const ma = movingAverage(values, 5); 
        const targetValue = m.standard_cycle_time ?? null; 
        // const targetValue = m.context?.standard_cycle_time ?? null; 
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
                    scales: {
                         y: {
                             beginAtZero: true,
                            max: targetValue 
                            ? targetValue * 1.6 
                            : undefined 
                        } 
                    },
                    plugins: {
                        annotation: {
                            annotations: { 
                                greenZone: { 
                                    type: 'box', 
                                    yMin: 0, 
                                    yMax: targetValue * 1.341, backgroundColor: 'rgba(0,255,0,0.1)', 
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
                                    yMax: targetValue * 1.477 + Math.max(...values) * 1.1, 
                                    backgroundColor: 'rgba(255,0,0,0.08)', 
                                    borderColor: 'rgba(255,0,0,0.5)' 
                                } 
                            } 
                        } 
                    } 
                } 
            }
            ); 
            chart.__machineId = id; // 🔥 track which machine chart belongs to 
            } else {
                 // 🔥 FULL UPDATE
                chart.data.labels = labels; 
                chart.data.datasets[0].data = values; 
                chart.data.datasets[1].data = ma; 
                
                if (targetValue) { 
                    const dynamicMax = Math.max(maxValue * 1.1, targetValue * 1.6); 
                    chart.options.scales.y.max = dynamicMax; 
                    if (!chart.data.datasets[2]) { 
                        chart.data.datasets.push({ 
                            label: 'Target', 
                            data: targetLine, 
                            borderWidth: 2, 
                            borderDash: [4,4], 
                            pointRadius: 0 }); 
                        } else {
                             chart.data.datasets[2].data = targetLine; 
                        } 
                } 
                // 🔥 Update dynamic red zone 
                if (targetValue && chart.options.plugins?.annotation) {
                    const maxValue = Math.max(...values, targetValue); 
                    chart.options.plugins.annotation.annotations.greenZone.yMax = targetValue * 1.341; 
                    chart.options.plugins.annotation.annotations.yellowZone.yMin = targetValue * 1.341; 
                    chart.options.plugins.annotation.annotations.yellowZone.yMax = targetValue * 1.477; 
                    chart.options.plugins.annotation.annotations.redZone.yMin = targetValue * 1.477; 
                    chart.options.plugins.annotation.annotations.redZone.yMax = Math.max(maxValue * 1.1, targetValue * 1.6); } chart.update('none');
                 } 
    } 

    function buildDepartments(state) {
        if (deptSelect.options.length > 1) return;

        const departments = [...new Set( Object.keys(state.machines).map(id => id.split('_')[0]) 
        )]; 
        deptSelect.innerHTML = `
            <option value="">Select Department</option>` + 
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
            machineSelect.innerHTML += `<option value="${machine}">${machine}</option>`; 
            }); 
    } 
    
    // 🔥 Subscribe for LIVE updates 
    efficiencyUnsubscribe = scadaStore.subscribe(state => {

        if (Object.keys(state.machines).length && deptSelect.options.length <= 1) {
            buildDepartments(state);
        }

        if (!deepLinkApplied) {
            const applied = applyDeepLink(state);
            if (applied) deepLinkApplied = true;
        }

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
    function applyDeepLink(state) {
        const hash = location.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex === -1) return false;

        const queryString = hash.substring(queryIndex + 1).trim();
        const params = new URLSearchParams(queryString);

        const deptParam = params.get('dept');
        const machineParam = params.get('machine');

        if (!deptParam || !machineParam) return false;

        if (!state.machines[`${deptParam}_${machineParam}`]) {
            return false;
        }

        deptSelect.value = deptParam;
        updateMachines(state, deptParam);

        machineSelect.value = machineParam;
        selectedId = `${deptParam}_${machineParam}`;

        renderMachineCard(selectedId, state.machines[selectedId]);

        return true;
    }
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
    </div>
  `;
}


// ---------------- STAFF MANAGEMENT page --------------- //
export function productionStaffManagementView() {
  return `
    <div class="card">
      <h2>Staff Management</h2>
    </div>
  `;
}

```

### sever.js
```javaScript
// backend/node/server.js
require('dotenv').config(); // Load .env
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const session = require('express-session');

// Initialize global services BEFORE importing modules that depend on them

const stateStore = require('./services/stateStore');
const logService = require('./services/logService');

global.services = {
  logService,  
  stateStore,  
  wss: null // Will be set later
};
logService.loadFromFile(10);
const alarmService = require('./services/alarmService');
global.services.alarmService = alarmService;

// Import services
const plcRoutes = require('./routes/api/plc');
const authRoutes = require('./routes/api/auth');
const auditRoutes = require('./routes/api/audit');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'scada-secret-dev', // Use strong secret in .env for prod
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize default role for unauthenticated users----------
app.use((req, res, next) => {
  // TEMP: default role (change later after login)
  if (!req.session.role) {
    req.session.role = 'operator';
  }
  next();
});


app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/plc', plcRoutes);
app.use('/api/alarms', require('./routes/api/alarm'));
app.use('/api/alarm-history', require('./routes/api/alarmHistory'));
app.use('/api/audit', auditRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '../../frontend/public')));


function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  // Redirect to login if not authenticated
  res.redirect('/login.html');
}

// Role-based middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/login.html');
    }
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).send('Access denied');
    }
    next();
  };
}

// Public: Home (any logged-in user)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Public: Production (operators + admins)
app.get('/production', requireRole(['operator', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Maintenance: operators + admins
app.get('/maintenance', requireRole(['operator', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Admin-only
app.get('/admin', requireRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Catch-all: redirect unknown paths to home (or 404)
app.get('/', requireAuth, (req, res) => {
  res.redirect('/');
});

// Initialize state store
async function bootstrap() {
  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocket.Server({ server });

  global.services.wss = wss;
  console.log('🔄 Hydrating state from database...');
  // Load engines FIRST
  const plcEngine = require('./services/plcEngine');
  const shiftEngine = require('./services/shiftEngine');
  const persistenceEngine = require('./services/persistenceEngine');
  const bootstrapEngine = require('./services/bootstrapEngine');

  // Register globally (only if you want global access)
  global.services.plcEngine = plcEngine;
  global.services.shiftEngine = shiftEngine;
  global.services.persistenceEngine = persistenceEngine;

  // Hydrate state
  await bootstrapEngine.hydrate();
  persistenceEngine.startDurationTicker();
  

  // Start periodic shift save
  persistenceEngine.startAutoSave();
  persistenceEngine.startDurationTicker();
  console.log('✅ Hydration complete');
  // Websocket + bridge AFTER engines exist
  const plcMonitor = require('./services/plcMonitor');
  const pythonBridge = require('./services/pythonBridge');

  plcMonitor.setWss(wss);

  global.services.plcMonitor = plcMonitor;
  global.services.pythonBridge = pythonBridge;

  setInterval(() => {
    const snapshot = stateStore.getPlcSnapshot();

    plcMonitor.broadcast({
      type: 'plc_snapshot',
      payload: snapshot
    });
    // console.log('📡 Broadcasting snapshot');
    // console.log(snapshot.machines['heat_DKK1'].shiftDurations);
  }, 10000); // every 10 sec

  // Auto-resume last state
  const state = global.services.stateStore.loadState();

  if (state.lastIntent === 'RUNNING') {
    console.log('🔄 Auto-resume: last state was RUNNING');
    setTimeout(() => {
      global.services.pythonBridge.start();
    }, 3000);
  } else {
    console.log('⏸️ Auto-resume: last state was STOPPED');
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    global.services.pythonBridge.shutdown();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  server.listen(PORT, () => {
    console.log(`✅ SCADA Node server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready`);
  });
}



// Start everything
bootstrap().catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});

```

### bootstrapEngine.js
```javaScript
// backend/node/services/bootstrapEngine.js
const { getDbPool } = require('./db');
const plcEngine = require('./plcEngine');

function normalizeRow(row) {
  return {
    department: row.department,
    machine: row.machine,
    machine_type: row.machine_type,
    timestamp: row.timestamp,

    context: {
      part_name: row.part_name ?? '',
      plan: row.plan ?? 0,
      operator_id: row.operator_id ?? ''
    },

    metrics: {
      run: row.run ?? 0,
      idle: row.idle ?? 0,
      alarm: row.alarm ?? 0,
      offline: row.offline ?? 0,
      alarm_code: row.alarm_code ?? 0,
      cycle_time: row.cycle_time ?? 0,
      count_shift: row.count_shift ?? 0,
      count_signal: row.count_signal ?? 0,
      heat: row.heat ?? 0,
      setting: row.setting ?? 0
    }
  };
}

async function hydrate() {
  const pool = await getDbPool();

  const tables = ['raw_press', 'raw_heat', 'raw_lathe'];

  for (const table of tables) {

    console.log(`🔄 Hydrating from ${table}...`);

    const [machines] = await pool.query(
      `SELECT DISTINCT machine FROM ${table}`
    );

    for (const m of machines) {

      const [rows] = await pool.query(
        `
        SELECT *
        FROM ${table}
        WHERE machine = ?
        ORDER BY id_row DESC
        LIMIT 1
        `,
        [m.machine]
      );

      if (!rows.length) continue;

      const normalized = normalizeRow(rows[0]);
      // 🔥 1️⃣ Get current shift info
      const shiftEngine = require('./shiftEngine');
      const shiftInfo = shiftEngine.getShiftInfo(Date.now());

      // 🔥 2️⃣ Load saved shift durations
      const [shiftRows] = await pool.query(
        `
        SELECT run_seconds, idle_seconds,
              alarm_seconds, offline_seconds
        FROM machine_shift_status
        WHERE date = ?
          AND shift = ?
          AND department = ?
          AND machine = ?
        LIMIT 1
        `,
        [
          shiftInfo.date,
          shiftInfo.shift,
          normalized.department,
          normalized.machine
        ]
      );

      if (shiftRows.length) {
        normalized.shiftDurations = {
          run_seconds: shiftRows[0].run_seconds,
          idle_seconds: shiftRows[0].idle_seconds,
          alarm_seconds: shiftRows[0].alarm_seconds,
          offline_seconds: shiftRows[0].offline_seconds
        };
      } else {
        normalized.shiftDurations = {
          run_seconds: 0,
          idle_seconds: 0,
          alarm_seconds: 0,
          offline_seconds: 0
        };
      }
      // 🔥 IMPORTANT: use plcEngine only
      plcEngine.processUpdate(normalized);
    }
  }

  console.log('✅ Hydration complete (clean architecture)');
}

module.exports = { hydrate };
```

### plcEngine.js
```javaScript
// backend/node/services/plcEngine.js
const stateStore = require('./stateStore');
const shiftEngine = require('./shiftEngine');


function processUpdate(payload) {

  const { department, machine, metrics = {}, context = {}, timestamp } = payload;

  const key = `${department.toLowerCase()}_${machine}`;
  const machineState = stateStore.getPlc(key) || {};
  
  const now = Date.now();

  const newStatus = stateStore.deriveStatus(department, metrics);

  let durations =
    payload.shiftDurations ||
    machineState.shiftDurations || {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };


  const shiftInfo = shiftEngine.getShiftInfo(now);

  const updated = {
    department,
    machine,
    machineType: payload.machine_type,
    status: newStatus,
    statusStartedAt: machineState.status !== newStatus
      ? now
      : machineState.statusStartedAt || now,
    shift: shiftInfo.shift,
    shiftDate: shiftInfo.date,
    shiftDurations: durations,
    timestamp: new Date(timestamp).getTime(),
    lastUpdate: now,
    context,
    tags: metrics
  };

  stateStore.updatePlcBase(key, updated);

  shiftEngine.detectAndHandleShift(key);
}

module.exports = { processUpdate };
```

### persistenceEngine.js
```javaScript
// backend/node/services/persistenceEngine.js
const stateStore = require('./stateStore');
const { getDbPool } = require('./db');

async function saveAllShifts() {

  const pool = await getDbPool();
  const machines = stateStore.getPlcSnapshot().machines;

  for (const [key, machine] of Object.entries(machines)) {

    if (!machine.shiftDurations) continue;

    await pool.query(
      `
      INSERT INTO machine_shift_status
      (date, shift, department, machine,
       run_seconds, idle_seconds,
       alarm_seconds, offline_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        run_seconds = VALUES(run_seconds),
        idle_seconds = VALUES(idle_seconds),
        alarm_seconds = VALUES(alarm_seconds),
        offline_seconds = VALUES(offline_seconds)
      `,
      [
        machine.shiftDate,
        machine.shift,
        machine.department,
        machine.machine,
        machine.shiftDurations.run_seconds,
        machine.shiftDurations.idle_seconds,
        machine.shiftDurations.alarm_seconds,
        machine.shiftDurations.offline_seconds
      ]
    );
  }
}

function startAutoSave() {
  setInterval(saveAllShifts, 60 * 1000);
}

async function saveMachineShift(machine) {
  const pool = await getDbPool();

  await pool.query(
    `
    INSERT INTO machine_shift_status
    (date, shift, department, machine,
     run_seconds, idle_seconds,
     alarm_seconds, offline_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      run_seconds = VALUES(run_seconds),
      idle_seconds = VALUES(idle_seconds),
      alarm_seconds = VALUES(alarm_seconds),
      offline_seconds = VALUES(offline_seconds)
    `,
    [
      machine.shiftDate,
      machine.shift,
      machine.department,
      machine.machine,
      machine.shiftDurations.run_seconds,
      machine.shiftDurations.idle_seconds,
      machine.shiftDurations.alarm_seconds,
      machine.shiftDurations.offline_seconds
    ]
  );
}

function accumulateCurrentStatus(machine) {
  const now = Date.now();
  const diff = Math.floor((now - machine.statusStartedAt) / 1000);

  const bucketMap = {
    RUNNING: 'run_seconds',
    IDLE: 'idle_seconds',
    ALARM: 'alarm_seconds',
    OFFLINE: 'offline_seconds'
  };

  const bucket = bucketMap[machine.status];
  if (bucket) {
    machine.shiftDurations[bucket] += diff;
  }

  machine.statusStartedAt = now;
}

function scheduleNextShiftCheck() {
  const now = new Date();
  const next = calculateNextShiftBoundary(now);

  const delay = next.getTime() - now.getTime();

  setTimeout(() => {
    processShiftBoundary();
    scheduleNextShiftCheck();
  }, delay);
}


function startDurationTicker() {
  setInterval(() => {

    const machines = stateStore.getPlcSnapshot().machines;

    for (const machine of Object.values(machines)) {

      if (!machine.status || !machine.shiftDurations) continue;

      const bucketMap = {
        RUNNING: 'run_seconds',
        IDLE: 'idle_seconds',
        ALARM: 'alarm_seconds',
        OFFLINE: 'offline_seconds'
      };

      const bucket = bucketMap[machine.status];
      if (!bucket) continue;

      machine.shiftDurations[bucket] += 1;
    }

  }, 1000);
}
module.exports = {
  saveMachineShift,
  accumulateCurrentStatus,
  scheduleNextShiftCheck,
  startAutoSave,
  startDurationTicker
};

```

### shiftEngine.js
```javaScript
// backend/node/services/shiftEngine.js
const stateStore = require('./stateStore');
const persistenceEngine = require('./persistenceEngine');

function getShiftInfo(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  let shift;

  if (hour >= 6 && hour < 14) shift = 'A';
  else if (hour >= 14 && hour < 22) shift = 'B';
  else shift = 'C';

  // Shift date handling (very important for shift C)
  let shiftDate = new Date(date);

  if (shift === 'C' && hour < 6) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return {
    shift,
    date: shiftDate.toISOString().slice(0, 10) // YYYY-MM-DD
  };
}


function detectAndHandleShift(key) {

  const machine = stateStore.getPlc(key);
  if (!machine) return;   // 🛡 safety guard

  const now = Date.now();
  const shiftInfo = getShiftInfo(now);
  
  if (
    machine.shift !== shiftInfo.shift ||
    machine.shiftDate !== shiftInfo.date
  ) {

    // save old shift
    persistenceEngine.saveMachineShift(machine);

    // reset
    machine.shift = shiftInfo.shift;
    machine.shiftDate = shiftInfo.date;
    machine.shiftDurations = {
      run_seconds: 0,
      idle_seconds: 0,
      alarm_seconds: 0,
      offline_seconds: 0
    };

    machine.statusStartedAt = now;
  }
}

module.exports = { detectAndHandleShift, getShiftInfo };
```

### stateStore.js
```javaScript
// backend/node/services/stateStore.js
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, '../data/systemState.json');


let runtimeState = {
  plc: {},          // 👈 LIVE PLC DATA
  meta: {
    lastIntent: 'STOPPED'
  }
};

/* ------------------ PLC STATE ------------------ */
function deriveStatus(department, metrics = {}) {
  // 1️⃣ Explicit offline
  if (metrics.offline === 1) return 'OFFLINE';

  const noSignal =
    !metrics.run &&
    !metrics.idle &&
    !metrics.alarm &&
    !metrics.setting &&
    !metrics.heat;

  if (noSignal) return 'OFFLINE';

  // 2️⃣ Alarm priority
  if (metrics.alarm === 1) return 'ALARM';

  // 3️⃣ Department-specific logic
  if (department?.toLowerCase() === 'heat') {
    // Heat rule:
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

  // 4️⃣ Default logic (Press, Lathe, etc.)
  if (metrics.run === 1) return 'RUNNING';
  if (metrics.idle === 1) return 'IDLE';

  return 'STOP';
}

function updatePlcBase(key, data) {
  runtimeState.plc[key] = {
    ...runtimeState.plc[key],
    ...data
  };
}

function getPlcSnapshot() {
  return {
    timestamp: Date.now(),
    machines: { ...runtimeState.plc }
  };
}

function getPlc(key) {
  return runtimeState.plc[key] || null;
}


/* ------------------ SYSTEM STATE ------------------ */
function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return runtimeState.meta;
    runtimeState.meta = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return runtimeState.meta;
  } catch {
    return runtimeState.meta;
  }
}

function saveState(state) {
  runtimeState.meta = { ...runtimeState.meta, ...state };
  fs.writeFileSync(STATE_FILE, JSON.stringify(runtimeState.meta, null, 2));
}


module.exports = {
  deriveStatus,
  updatePlcBase,
  getPlcSnapshot,
  getPlc,
  loadState,
  saveState,
};

```

