// frontend/public/js/views/production.js 
import { scadaStore } from '../store.js'; 
import { formatDuration } from '../utils.js';
// const DEPT_ORDER = ['press', 'heat', 'lathe', 'grinding']; 
const DEPT_ORDER = ['press', 'heat', 'lathe']; 

const availabilityCharts = new Map();
// --------------- Chart plugins --------------- //
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const { ctx, chartArea: { width, height } } = chart;

        const data = chart.data.datasets[0].data;
        const total = data.reduce((a, b) => a + b, 0);

        const percent = total > 0
            ? ((data[0] / total) * 100).toFixed(1)
            : 0;

        ctx.save();

        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#485583";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(percent + "%", width / 2, height / 2);

        ctx.restore();
    }
};

// --------------- GLOBALS functions --------------- //
const SHIFT_ORDER = ['A', 'B', 'C'];
let shiftTrendChart = null;

const SHIFT_SCHEDULE = {
    A: { start: "06:00", end: "14:00" },
    B: { start: "14:00", end: "22:00" },
    C: { start: "22:00", end: "06:00" }
};
let shiftWindow = null;
function formatShiftDate(dateStr) {
    const d = new Date(dateStr);

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short"
    });
}
function calculateShiftSummary() {

    const machines = Object.values(scadaStore.state.machines);

    let totalRun = 0;
    let totalIdle = 0;
    let totalAlarm = 0;

    machines.forEach(m => {

        if (!m.shiftDurations) return;

        let run = m.shiftDurations.run_seconds || 0;
        let idle = m.shiftDurations.idle_seconds || 0;
        let alarm = m.shiftDurations.alarm_seconds || 0;

        const now = Date.now();

        if (m.statusStartedAt) {

            const delta = Math.floor((now - m.statusStartedAt) / 1000);

            if (m.status === 'RUNNING') run += delta;
            if (m.status === 'IDLE') idle += delta;
            if (m.status === 'ALARM') alarm += delta;
        }

        totalRun += run;
        totalIdle += idle;
        totalAlarm += alarm;

    });

    const planned = totalRun + totalIdle + totalAlarm;
    const availability = planned ? (totalRun / planned) * 100 : 0;

    return {
        availability,
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
function renderShiftChart(data) {

  const ctx = document.getElementById('shiftChart').getContext('2d');

  const shifts = data.map(s => `Shift ${s.shift}`);

  const departmentsSet = new Set();

  data.forEach(s => {
    s.departments.forEach(d => {
      departmentsSet.add(d.department);
    });
  });

  const departments = Array.from(departmentsSet);

  const datasets = departments.map(dept => {

    const values = data.map(shift => {
      const found = shift.departments.find(d => d.department === dept);
      return found ? (found.availability * 100).toFixed(2) : 0;
    });

    return {
      label: dept,
      data: values
    };
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shifts,
      datasets
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}
function renderShiftTrendChart(data) {

    // const ctx = document.getElementById("shiftTrendChart");
    const ctx = document.getElementById("shiftTrendChart")?.getContext("2d");
    if (!ctx) return;

    // compute plant availability per shift
    const labels = [];
    const values = [];

    data.slice(0,10).reverse().forEach(shift => {

        let run = 0;
        let total = 0;

        shift.departments.forEach(d => {

            const v = d.availability * 100;

            total += 100;
            run += v;

        });

        const availability = total ? (run / total) * 100 : 0;

        labels.push(`Shift ${shift.shift}`);
        values.push(availability.toFixed(1));

    });

    if (!shiftTrendChart) {

        shiftTrendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Plant Availability",
                    data: values,
                    tension: 0.4,
                    fill: false,
                    borderWidth: 3,
                    pointRadius: 5,
                    
                }]
            },
            options: {
                animation: false,
                responsive: true,
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
                
            }
        });

    } else {

        shiftTrendChart.data.labels = labels;
        shiftTrendChart.data.datasets[0].data = values;
        shiftTrendChart.update("none");

    }

}
function buildShiftWindow(currentShift) {

    const index = SHIFT_ORDER.indexOf(currentShift);
    const size = SHIFT_ORDER.length;

    return [
        SHIFT_ORDER[(index - 2 + size) % size],
        SHIFT_ORDER[(index - 1 + size) % size],
        SHIFT_ORDER[index],
        SHIFT_ORDER[(index + 1) % size]
    ];

}
function createShiftSummaryGrid(container,shifts) {

    container.innerHTML = "";

    // SHIFT_ORDER.forEach(shift => {
    shifts.forEach(shift => {
        const col = document.createElement("div");
        col.className = "shift-column";

        const key = `${shift.date}_${shift.shift}`;
        col.dataset.shiftKey = key;
        const header = document.createElement("div");
        header.className = "shift-header";
        header.innerHTML = `
            <div class="shift-badge" id="badge_${key}"></div>
            <div class="shift-title">Shift ${shift.shift}</div>
            <div class="shift-date" id="date_${key}">--</div>
            <div class="shift-time">
                ${SHIFT_SCHEDULE[shift.shift].start} - ${SHIFT_SCHEDULE[shift.shift].end}
            </div>
        `;

        col.appendChild(header);
        DEPT_ORDER.forEach(dept => {

            const row = document.createElement("div");
            row.className = "dept-row";
            row.innerHTML = `
                <span class="dept-name">${dept}</span>
                <div class="dept-bar">
                    <div class="dept-bar-fill" id="bar_${key}_${dept}"></div>
                </div>
                <span class="dept-value">
                    <span id="shift_${key}_${dept}">0%</span>
                    <span id="trend_${key}_${dept}" class="trend"></span>
                </span>
            `;

            col.appendChild(row);
        });

        container.appendChild(col);
    });

}

function updateShiftSummaryBars(data, currentShift, shifts) {
    const normalized = data;
    normalized.forEach(shift => {
        const shiftIndex = normalized.findIndex(
            s => s.shift === shift.shift && s.date === shift.date
        );

        const prevShift = normalized[shiftIndex + 1];
        // highlight current shift
        const key = `${shift.date}_${shift.shift}`;
        const col = document.querySelector(`[data-shift-key="${key}"]`);
        const badgeEl = document.getElementById(`badge_${key}`);

        if (badgeEl) {

            badgeEl.className = "shift-badge";

            if (shiftIndex === 0) {
                badgeEl.textContent = "CURRENT";
                badgeEl.classList.add("badge-current");
            }
            else if (shiftIndex === 1) {
                badgeEl.textContent = "PREVIOUS";
                badgeEl.classList.add("badge-previous");
            }
            else if (shiftIndex === 2) {
                badgeEl.textContent = "OLD";
                badgeEl.classList.add("badge-old");
            }
            else {
                badgeEl.textContent = "OLDER";
                badgeEl.classList.add("badge-older");
            }

        }
        const dateEl = document.getElementById(`date_${key}`);  
        if (dateEl && shift.date) {
            dateEl.textContent = formatShiftDate(shift.date);
        }
        if (col) {
            col.classList.remove("current-shift");

            if (shiftIndex === 0) {
                col.classList.add("current-shift");
            }

            if (shiftIndex === 0) {
                col.classList.remove("future");
            } else {
                col.classList.remove("future");
            }        
        }

        shift.departments.forEach(dept => {

            const percent = dept.availability * 100;
            const deptKey = dept.department.toLowerCase();

            const valueEl = document.getElementById(`shift_${key}_${deptKey}`);
            const barEl = document.getElementById(`bar_${key}_${deptKey}`);
            const trendEl = document.getElementById(`trend_${key}_${deptKey}`);

            if (!valueEl) return;

            valueEl.textContent = `${percent.toFixed(0)}%`;

            if (barEl) {
                barEl.style.width = `${percent}%`;
            }

            // calculate trend
            const prevDept =
                prevShift?.departments?.find(d => d.department.toLowerCase() === deptKey);

            const prevAvail = prevDept ? prevDept.availability * 100 : null;

            const trend = getTrend(percent, prevAvail);

            if (trendEl) {
                trendEl.className = `trend ${trend.class}`;
                trendEl.textContent = `${trend.arrow} ${trend.diff}`;
            }

        });

    });

}

function updateFactorySummary(container) {

    const summary = calculateShiftSummary();

    const availabilityEl = container.querySelector('#summaryAvailability');
    const runEl = container.querySelector('#summaryRun');
    const idleEl = container.querySelector('#summaryIdle');
    const alarmEl = container.querySelector('#summaryAlarm');

    if (!availabilityEl) return;

    availabilityEl.textContent = `${summary.availability.toFixed(1)}%`;
    availabilityEl.className = kpiClass(summary.availability);

    runEl.textContent = formatTime(summary.totalRun);
    idleEl.textContent = formatTime(summary.totalIdle);
    alarmEl.textContent = formatTime(summary.totalAlarm);
}
async function loadTodayShiftHistory() {

    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(`/api/shift-history?date=${today}`);
    const json = await res.json();

    const shifts = json.data;

    // if (!shiftWindow) {
    const grid = document.getElementById("shiftSummaryGrid");

    if (!shiftWindow || !grid.children.length) {
        shiftWindow = shifts.slice(0, 4);
        createShiftSummaryGrid(
            document.getElementById("shiftSummaryGrid"),
            shiftWindow
        );
    }
    updateShiftSummaryBars(json.data, json.currentShift, shifts);
    renderShiftTrendChart(json.data);
}
function getNextShift(currentShift){

    const order = ['A','B','C'];

    const index = order.indexOf(currentShift);

    return order[(index + 1) % order.length];

}
function getTrend(current, previous) {
    if (previous === null || previous === undefined) {
        return { arrow: '', diff: '', class: '' };
    }

    const diff = (current - previous).toFixed(1);

    if (diff > 0) {
        return { arrow: '▲', diff: `+${diff}%`, class: 'trend-up' };
    }

    if (diff < 0) {
        return { arrow: '▼', diff: `${diff}%`, class: 'trend-down' };
    }

    return { arrow: '→', diff: '0%', class: 'trend-flat' };
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
            <h1>🏭 Production Overview</h1>

            <div class="summary-panel">
                <div class="factory-summary">
                    <div class="summary-box">
                        Availability
                        <span id="summaryAvailability"></span>
                    </div>
                    <div class="summary-box">
                        Run
                        <span id="summaryRun"></span>
                    </div>
                    <div class="summary-box">
                        Idle
                        <span id="summaryIdle"></span>
                    </div>
                    <div class="summary-box">
                        Alarm
                        <span id="summaryAlarm"></span>
                    </div>
                </div>
            </div>

            <div class="shift-trend-container">
                <canvas id="shiftTrendChart"></canvas>
            </div>
            <div class="shift-summary-panel">
                <h2>Shift Availability</h2>


                <div id="shiftSummaryGrid" class="shift-summary-grid"></div>
            </div>

            <section id="machine-grid" class="machine-grid"></section>
            `;
    
    const shiftGrid = container.querySelector('#shiftSummaryGrid');
    loadTodayShiftHistory();
    summaryTimer = setInterval(() => {
        updateFactorySummary(container);
    }, 1000);

    shiftTimer = setInterval(() => {
        loadTodayShiftHistory();
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


    function statusClass(machine) {
        if (machine.status === 'OFFLINE') return 'offline'; 
        if (machine.alarms?.length) return 'alarm'; 
        return machine.status?.toLowerCase() || 'idle'; 
    }

    function createMachineCard(id, m) {
        const card = document.createElement('div');
        card.className = `machine-card ${statusClass(m)}`;

        card.innerHTML = `
            <div class="machine-header">
                <div class="machine-name">
                    <span class="dot ${m.status?.toLowerCase()}"></span>
                    <span class="machine-label"></span>
                </div>
                <span class="status-badge ${m.status?.toLowerCase()}"></span>
            </div>

            <div class="machine-image">
                <img src="/images/${id}.png" alt="${id}" />
            </div>

            <div class="machine-meta-container">
                <div class="machine-meta-grid">
                    <div><i class="fa-brands fa-product-hunt" style="color: rgba(116, 192, 252, 1);"></i> </div>
                    <div class="meta-part"></div>
                </div>
                <div class="machine-meta-grid">
                    <div><i class="fa-solid fa-user" style="color: rgba(116, 192, 252, 1);"></i> </div>
                    <div class="meta-operator"></div>
                </div>
            </div>

            <div class="machine-kpi-grid">
                <div class="kpi-box">
                    <div class="kpi-label">Cycle Time</div>
                    <div class="kpi-value cycle-time"></div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-label">Count</div>
                    <div class="kpi-value count-shift"></div>
                </div>
            </div>

            <div class="machine-shift-availability-container">
                <div class="machine-shift-grid">
                    <div class="shift-box"><div class="shift-label">Run</div><div class="shift-value shift-run"></div></div>
                    <div class="shift-box"><div class="shift-label">Idle</div><div class="shift-value shift-idle"></div></div>
                    <div class="shift-box"><div class="shift-label">Alarm</div><div class="shift-value shift-alarm"></div></div>
                    <div class="shift-box"><div class="shift-label">Offline</div><div class="shift-value shift-offline"></div></div>
                </div>
                
                <div class="machine-availability-chart">
                    <div class="availability-label">Availability <i class="fa-solid fa-caret-up" style="color: rgb(116, 192, 252);"></i> Run <i class="fa-solid fa-caret-down" style="color: rgb(236, 39, 39);"></i> Loss</div>
                    <canvas></canvas>
                </div>
            </div>

            <div class="machine-footer"></div>
        `;

        const ctx = card.querySelector('canvas');

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Run', 'Loss'],
                datasets: [{
                    data: [0, 0]
                }]
            },
            options: {
                animation: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            },
            plugins: [centerTextPlugin] 
        });

        availabilityCharts.set(id, chart);

        card.addEventListener('click', () => {
            const [dept, machine] = id.split('_');
            window.location.hash =
                `#production/machine_efficiency?dept=${dept}&machine=${machine}`;
        });
        
        updateMachineCard(card, id, m);
        return card;
    }

    function updateMachineCard(card, id, m) {
        const run = m.shiftDurations?.run_seconds || 0;
        const idle = m.shiftDurations?.idle_seconds || 0;
        const alarm = m.shiftDurations?.alarm_seconds || 0;
        const offline = m.shiftDurations?.offline_seconds || 0;

        const planned = run + idle + alarm;
        const available = run;
        const notAvailable = planned - run;

        // 🔹 Update classes
        card.className = `machine-card ${statusClass(m)}`;

        // 🔹 Header
        card.querySelector('.machine-label').textContent =
            id.split('_')[1];

        const badge = card.querySelector('.status-badge');
        badge.textContent = m.status ?? '--';
        badge.className = `status-badge ${m.status?.toLowerCase()}`;

        const dot = card.querySelector('.dot');
        dot.className = `dot ${m.status?.toLowerCase()}`;

        // 🔹 Meta
        card.querySelector('.meta-part').textContent =
            m.context?.part_name ?? '--';

        card.querySelector('.meta-operator').textContent =
            m.context?.operator_id ?? '--';

        // 🔹 KPI
        card.querySelector('.cycle-time').textContent =
            `${m.tags?.cycle_time ?? '--'} s`;

        card.querySelector('.count-shift').textContent =
            `${m.tags?.count_shift ?? '--'} / ${m.context?.plan ?? '--'}`;

        // 🔹 Shift durations
        card.querySelector('.shift-run').textContent =
            formatDuration(run, m.status === 'RUNNING' ? m.statusStartedAt : null);

        card.querySelector('.shift-idle').textContent =
            formatDuration(idle, m.status === 'IDLE' ? m.statusStartedAt : null);

        card.querySelector('.shift-alarm').textContent =
            formatDuration(alarm, m.status === 'ALARM' ? m.statusStartedAt : null);

        card.querySelector('.shift-offline').textContent =
            formatDuration(offline, m.status === 'OFFLINE' ? m.statusStartedAt : null);

        // 🔹 Footer timestamp
        card.querySelector('.machine-footer').textContent =
            `⏱ ${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '--'}`;

        // 🔹 Update chart only
        const chart = availabilityCharts.get(id);
        if (chart) {
            chart.data.datasets[0].data = [available, notAvailable];
            chart.update('none');
        }
    }
} 
export function productionOverviewUnmount() {

    if (unsubscribe) unsubscribe();

    if (summaryTimer) clearInterval(summaryTimer);
    if (shiftTimer) clearInterval(shiftTimer);

    if (shiftTrendChart) {
        shiftTrendChart.destroy();
        shiftTrendChart = null;
    }

    availabilityCharts.forEach(chart => chart.destroy());
    availabilityCharts.clear();

    initialized = false;
    shiftWindow = null;
}
// Make the whole dashboard update with ONE 1-second loop

// Instead of multiple updates (cards, summary, timers).

// This will make your system scale to 200+ machines without lag.
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
