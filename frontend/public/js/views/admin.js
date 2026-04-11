// frontend/public/js/views/admin.js
import { sendPlcCommand } from '../api.js';
import { scadaStore } from '../store.js';
let alarmTimer = null;  
async function refreshPlcStatus() {
  const res = await fetch('/api/plc/status', {
    credentials: 'same-origin'
  });
  return res.json();
}
function updateUIFromStatus(status) {
  const badge = document.getElementById('plc-badge');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');

  if (!status.connected && status.running) {
    badge.textContent = 'PLC FAULT';
    badge.className = 'badge badge-red';
    btnStart.disabled = true;
    btnStop.disabled = false;
  }
  else if (!status.connected) {
    badge.textContent = 'DISCONNECTED';
    badge.className = 'badge badge-gray';
    btnStart.disabled = true;
    btnStop.disabled = true;
  }
  else if (status.running && !status.healthy) {
    badge.textContent = 'PLC FAULT';
    badge.className = 'badge badge-red';
    btnStart.disabled = true;
    btnStop.disabled = false;
  }
  else if (status.running) {
    badge.textContent = 'RUNNING';
    badge.className = 'badge badge-green';
    btnStart.disabled = true;
    btnStop.disabled = false;
  }
  else {
    badge.textContent = 'STOPPED';
    badge.className = 'badge badge-red';
    btnStart.disabled = false;
    btnStop.disabled = true;
  }
}

// ---------------- Alarm Page ---------------- // 
export function adminAlarmView() {
  return `
      <h1>⚙️ Admin Panel</h1>
      <p>Manage PLC and view real-time data.</p>
      <div class="card">
        <strong>Status:</strong>
        <span id="plc-badge" class="badge badge-gray">UNKNOWN</span>
      </div>

      <div class="card">
        <button id="btn-start">▶️ Start</button>
        <button id="btn-stop">⏹️ Stop</button>
        <input id="write-tag" placeholder="Tag" value="B10">
        <input id="write-value" type="number" value="1">
        <button id="btn-write">✍️ Write</button>
      </div>

      <div class="card">
        <label>Alarm History Range:</label>
        <select id="alarm-range">
          <option value="15">Last 15 minutes</option>
          <option value="30">Last 30 minutes</option>
          <option value="60" selected>Last 1 hour</option>
          <option value="480">Last 8 hours</option>
          <option value="1440">Last 24 hours</option>
        </select>
      </div>      

      <div class="card">
        <h3>🚨 Active Alarms</h3>
        <ul id="alarm-list" class="alarm-list"></ul>
      </div>

      <div class="card">
        <h3>🧾 Alarm History</h3>
        <ul id="alarm-history" class="alarm-history"></ul>
      </div>
  `;
}
export async function adminAlarmMount() {
  // Initial status fetch
  const status = await refreshPlcStatus();
  const alarmList = document.getElementById('alarm-list');
  updateUIFromStatus(status);

  document.getElementById('btn-start').addEventListener('click', async () => {
    await sendPlcCommand('start');
    const status = await refreshPlcStatus();
    updateUIFromStatus(status);
  });

  document.getElementById('btn-stop').addEventListener('click', async () => {
    await sendPlcCommand('stop');
    const status = await refreshPlcStatus();
    updateUIFromStatus(status);
  });

  document.getElementById('btn-write').addEventListener('click', () => {
    const tag = document.getElementById('write-tag').value;
    const value = parseInt(document.getElementById('write-value').value);
    sendPlcCommand('write', { tag, value });
  });

  function handleAlarmEvent(msg) {
    if (msg.type !== 'alarm_event') return;
    loadAlarms(); // re-render list instantly
  }

  alarmList.onclick = async (e) => {
    if (!e.target.classList.contains('ack-btn')) return;

    const id = e.target.dataset.id;

    await fetch(`/api/alarms/ack/${id}`, {
      method: 'POST',
      credentials: 'same-origin'
    });

    loadAlarms();
  };

  async function loadAlarms() {
    const rangeMin = document.getElementById('alarm-range')?.value || 60;

    const from = new Date(Date.now() - rangeMin * 60 * 1000).toISOString();

    const res = await fetch(
      `/api/alarm-history?from=${encodeURIComponent(from)}`,
      { credentials: 'same-origin' }
    );

    if (!res.ok) {
      alarmList.innerHTML = '<li>No alarm access</li>';
      return;
    }

    const alarms = await res.json();

    if (!Array.isArray(alarms)) return;

    alarmList.innerHTML = alarms
      .slice()
      .reverse()
      .map(a => `
        <li class="alarm ${a.severity.toLowerCase()}">
          <strong>${a.code}</strong>
          <span>${a.message}</span>
          <small>${new Date(a.ts).toLocaleString()}</small>
        </li>
      `)
      .join('');
  }

  async function loadAlarmHistory() {
    const el = document.getElementById('alarm-history');

    const res = await fetch('/api/alarm-history', {
      credentials: 'same-origin'
    });

    if (!res.ok) {
      el.innerHTML = '<li>No access</li>';
      return;
    }

    const logs = await res.json();

    el.innerHTML = logs
      .slice()
      .reverse()
      .map(l => `
        <li class="alarm ${l.severity.toLowerCase()}">
          <strong>${l.code}</strong>
          <span>${l.message}</span>
          <small>${new Date(l.ts).toLocaleString()}</small>
        </li>
      `)
      .join('');
  }
  const ws = scadaStore.ws;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    handleAlarmEvent(msg);
  });

  document.getElementById('alarm-range')
  .addEventListener('change', loadAlarms);

  await loadAlarms();
  await loadAlarmHistory();

}
export function adminAlarmUnmount() {
  if (alarmTimer) clearInterval(alarmTimer);
}

// ---------------- Database Page ---------------- // 
export function adminDatabaseView() {
  return `
    <div class="card">
      <h2>Content Management</h2>
      <image src="/images/Availability.png" style="width: 600px; height: auto;"><br>
      <image src="/images/Performance.png" style="width: 600px; height: auto;"><br>
      <image src="/images/OEE.png" style="width: 600px; height: auto;">
    </div>
  `;
}

// ---------------- Roadmap Page ---------------- // 
export function adminRoadmapView() {
  return `<div id="roadmap-page"></div>`;
}
export function adminRoadmapMount(container) {
  const page = container.querySelector('#roadmap-page');

  // ── SVG definitions (shared arrow marker) ─────────────────────────────
  const ARROW_DEFS = `<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>`;

  // ── SVG 1: System architecture ─────────────────────────────────────────
  const svgArchitecture = `<svg width="100%" viewBox="0 0 680 520">
    ${ARROW_DEFS}
    <g class="c-gray"><rect x="12" y="12" width="656" height="496" rx="12" stroke-width="0.5"/>
      <text class="th" x="340" y="36" text-anchor="middle" dominant-baseline="central">System architecture — five layers</text>
    </g>
    <g class="c-amber">
      <rect x="30" y="55" width="168" height="108" rx="8" stroke-width="0.5"/>
      <text class="th" x="114" y="79" text-anchor="middle" dominant-baseline="central">PLC hardware</text>
      <text class="ts" x="114" y="97" text-anchor="middle" dominant-baseline="central">Mitsubishi MC protocol</text>
      <text class="ts" x="114" y="113" text-anchor="middle" dominant-baseline="central">ports 5010/5011/5012</text>
      <text class="ts" x="114" y="129" text-anchor="middle" dominant-baseline="central">bits + words every 0.3s</text>
      <text class="ts" x="114" y="145" text-anchor="middle" dominant-baseline="central">heartbeat each cycle</text>
    </g>
    <g class="c-coral">
      <rect x="218" y="55" width="168" height="108" rx="8" stroke-width="0.5"/>
      <text class="th" x="302" y="79" text-anchor="middle" dominant-baseline="central">Python layer</text>
      <text class="ts" x="302" y="97" text-anchor="middle" dominant-baseline="central">plc_service.py — TCP :8081</text>
      <text class="ts" x="302" y="113" text-anchor="middle" dominant-baseline="central">plc_loop.py — threads</text>
      <text class="ts" x="302" y="129" text-anchor="middle" dominant-baseline="central">clean_data.py — parse</text>
      <text class="ts" x="302" y="145" text-anchor="middle" dominant-baseline="central">db_writer.py → MySQL</text>
    </g>
    <g class="c-teal">
      <rect x="406" y="55" width="168" height="108" rx="8" stroke-width="0.5"/>
      <text class="th" x="490" y="79" text-anchor="middle" dominant-baseline="central">MySQL database</text>
      <text class="ts" x="490" y="97" text-anchor="middle" dominant-baseline="central">raw_press / raw_heat</text>
      <text class="ts" x="490" y="113" text-anchor="middle" dominant-baseline="central">raw_lathe</text>
      <text class="ts" x="490" y="129" text-anchor="middle" dominant-baseline="central">machine_shift_status</text>
      <text class="ts" x="490" y="145" text-anchor="middle" dominant-baseline="central">source_plc_location</text>
    </g>
    <line x1="198" y1="109" x2="216" y2="109" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="386" y1="109" x2="404" y2="109" stroke="#1D9E75" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="100" y="210" width="480" height="160" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="234" text-anchor="middle" dominant-baseline="central">Node.js backend — server.js</text>
      <rect x="115" y="248" width="130" height="108" rx="6" stroke-width="0.5"/>
      <text class="th" x="180" y="268" text-anchor="middle" dominant-baseline="central">Services</text>
      <text class="ts" x="180" y="286" text-anchor="middle" dominant-baseline="central">pythonBridge.js</text>
      <text class="ts" x="180" y="302" text-anchor="middle" dominant-baseline="central">plcEngine.js</text>
      <text class="ts" x="180" y="318" text-anchor="middle" dominant-baseline="central">stateStore.js</text>
      <text class="ts" x="180" y="334" text-anchor="middle" dominant-baseline="central">shiftEngine.js</text>
      <rect x="255" y="248" width="130" height="108" rx="6" stroke-width="0.5"/>
      <text class="th" x="320" y="268" text-anchor="middle" dominant-baseline="central">Persistence</text>
      <text class="ts" x="320" y="286" text-anchor="middle" dominant-baseline="central">bootstrapEngine.js</text>
      <text class="ts" x="320" y="302" text-anchor="middle" dominant-baseline="central">persistenceEngine.js</text>
      <text class="ts" x="320" y="318" text-anchor="middle" dominant-baseline="central">db.js pool</text>
      <text class="ts" x="320" y="334" text-anchor="middle" dominant-baseline="central">logService.js</text>
      <rect x="395" y="248" width="170" height="108" rx="6" stroke-width="0.5"/>
      <text class="th" x="480" y="268" text-anchor="middle" dominant-baseline="central">API routes</text>
      <text class="ts" x="480" y="286" text-anchor="middle" dominant-baseline="central">api/plc.js · api/auth.js</text>
      <text class="ts" x="480" y="302" text-anchor="middle" dominant-baseline="central">api/alarm.js</text>
      <text class="ts" x="480" y="318" text-anchor="middle" dominant-baseline="central">shiftHistory.js</text>
      <text class="ts" x="480" y="334" text-anchor="middle" dominant-baseline="central">shiftSummary.js</text>
    </g>
    <path d="M302 163 L302 190 L340 190 L340 208" fill="none" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <text class="ts" x="352" y="182" dominant-baseline="central">TCP :8081</text>
    <path d="M490 163 L490 190 L570 190 L570 256 L567 256" fill="none" stroke="#1D9E75" stroke-width="1" marker-end="url(#arr)"/>
    <text class="ts" x="518" y="182" dominant-baseline="central">SQL queries</text>
    <g class="c-purple">
      <rect x="100" y="428" width="480" height="64" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="452" text-anchor="middle" dominant-baseline="central">Browser — frontend</text>
      <text class="ts" x="340" y="470" text-anchor="middle" dominant-baseline="central">app.js → routes.js → views (home, production, admin) → store.js</text>
      <text class="ts" x="340" y="484" text-anchor="middle" dominant-baseline="central">WebSocket (plc_clean, plc_snapshot) + REST API calls</text>
    </g>
    <path d="M340 370 L340 426" fill="none" stroke="#534AB7" stroke-width="1" marker-end="url(#arr)"/>
    <text class="ts" x="352" y="400" dominant-baseline="central">WS + HTTP</text>
  </svg>`;

  // ── SVG 2: Data flow ────────────────────────────────────────────────────
  const svgDataFlow = `<svg width="100%" viewBox="0 0 680 760">
    ${ARROW_DEFS}
    <text class="th" x="340" y="22" text-anchor="middle" dominant-baseline="central">Data flow — PLC read to browser render</text>
    <g class="c-amber">
      <rect x="200" y="40" width="280" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="58" text-anchor="middle" dominant-baseline="central">_loop_read_plc_worker()</text>
      <text class="ts" x="340" y="72" text-anchor="middle" dominant-baseline="central">mc.batchread every 0.3 s → main_q_intersection</text>
    </g>
    <line x1="340" y1="84" x2="340" y2="108" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-amber">
      <rect x="200" y="110" width="280" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="128" text-anchor="middle" dominant-baseline="central">_main_queue_intersection()</text>
      <text class="ts" x="340" y="142" text-anchor="middle" dominant-baseline="central">fans to press_q / heat_q / lathe_q</text>
    </g>
    <path d="M230 154 L130 184" fill="none" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="340" y1="154" x2="340" y2="184" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <path d="M450 154 L550 184" fill="none" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-amber">
      <rect x="40" y="186" width="170" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="125" y="204" text-anchor="middle" dominant-baseline="central">press_clean()</text>
      <text class="ts" x="125" y="218" text-anchor="middle" dominant-baseline="central">parse bits + words</text>
    </g>
    <g class="c-amber">
      <rect x="255" y="186" width="170" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="204" text-anchor="middle" dominant-baseline="central">heat_clean()</text>
      <text class="ts" x="340" y="218" text-anchor="middle" dominant-baseline="central">parse bits + words</text>
    </g>
    <g class="c-amber">
      <rect x="470" y="186" width="170" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="555" y="204" text-anchor="middle" dominant-baseline="central">lathe_clean()</text>
      <text class="ts" x="555" y="218" text-anchor="middle" dominant-baseline="central">parse bits + words</text>
    </g>
    <line x1="125" y1="230" x2="125" y2="274" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="340" y1="230" x2="340" y2="274" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="555" y1="230" x2="555" y2="274" stroke="#BA7517" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-coral">
      <rect x="40" y="276" width="170" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="125" y="296" text-anchor="middle" dominant-baseline="central">clean_db_q</text>
      <text class="ts" x="125" y="312" text-anchor="middle" dominant-baseline="central">db_writer.save_()</text>
      <text class="ts" x="125" y="326" text-anchor="middle" dominant-baseline="central">INSERT raw table</text>
    </g>
    <g class="c-coral">
      <rect x="255" y="276" width="170" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="296" text-anchor="middle" dominant-baseline="central">broadcast_q</text>
      <text class="ts" x="340" y="312" text-anchor="middle" dominant-baseline="central">_broadcast_to_node()</text>
      <text class="ts" x="340" y="326" text-anchor="middle" dominant-baseline="central">TCP → plc_clean JSON</text>
    </g>
    <g class="c-coral">
      <rect x="470" y="276" width="170" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="555" y="296" text-anchor="middle" dominant-baseline="central">send_heartbeat()</text>
      <text class="ts" x="555" y="312" text-anchor="middle" dominant-baseline="central">every read cycle</text>
      <text class="ts" x="555" y="326" text-anchor="middle" dominant-baseline="central">watchdog reset timer</text>
    </g>
    <line x1="340" y1="332" x2="340" y2="366" stroke="#993C1D" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="140" y="368" width="400" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="388" text-anchor="middle" dominant-baseline="central">pythonBridge.js handleMessage()</text>
      <text class="ts" x="340" y="404" text-anchor="middle" dominant-baseline="central">heartbeat → watchdog reset</text>
      <text class="ts" x="340" y="418" text-anchor="middle" dominant-baseline="central">plc_clean → plcEngine.processUpdate()</text>
    </g>
    <line x1="340" y1="424" x2="340" y2="458" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="140" y="460" width="400" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="480" text-anchor="middle" dominant-baseline="central">plcEngine.processUpdate()</text>
      <text class="ts" x="340" y="496" text-anchor="middle" dominant-baseline="central">deriveStatus · merge tags · cycleHistory</text>
      <text class="ts" x="340" y="510" text-anchor="middle" dominant-baseline="central">stateStore.updatePlcBase() · detectAndHandleShift()</text>
    </g>
    <line x1="340" y1="516" x2="340" y2="550" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="140" y="552" width="400" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="570" text-anchor="middle" dominant-baseline="central">stateStore runtimeState.plc</text>
      <text class="ts" x="340" y="584" text-anchor="middle" dominant-baseline="central">in-memory machines map · getPlcSnapshot()</text>
    </g>
    <line x1="340" y1="596" x2="340" y2="630" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="140" y="632" width="400" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="650" text-anchor="middle" dominant-baseline="central">plcMonitor.broadcast()</text>
      <text class="ts" x="340" y="664" text-anchor="middle" dominant-baseline="central">plc_clean → all WebSocket clients</text>
    </g>
    <line x1="340" y1="676" x2="340" y2="710" stroke="#534AB7" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-purple">
      <rect x="140" y="712" width="400" height="44" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="730" text-anchor="middle" dominant-baseline="central">store.js applyPlcClean() → notify()</text>
      <text class="ts" x="340" y="744" text-anchor="middle" dominant-baseline="central">merge tags · cycleHistory · subscribers re-render</text>
    </g>
  </svg>`;

  // ── SVG 3: Frontend routing ─────────────────────────────────────────────
  const svgFrontend = `<svg width="100%" viewBox="0 0 680 660">
    ${ARROW_DEFS}
    <text class="th" x="340" y="22" text-anchor="middle" dominant-baseline="central">Frontend — routing and view lifecycle</text>
    <g class="c-purple">
      <rect x="200" y="40" width="280" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="60" text-anchor="middle" dominant-baseline="central">app.js bootstrap()</text>
      <text class="ts" x="340" y="76" text-anchor="middle" dominant-baseline="central">checkAuth · initWebSocket · mountSidebar</text>
      <text class="ts" x="340" y="88" text-anchor="middle" dominant-baseline="central">startClock · navigate('home')</text>
    </g>
    <line x1="340" y1="96" x2="340" y2="120" stroke="#534AB7" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-purple">
      <rect x="200" y="122" width="280" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="142" text-anchor="middle" dominant-baseline="central">navigate(route)</text>
      <text class="ts" x="340" y="158" text-anchor="middle" dominant-baseline="central">routes.js lookup · role guard</text>
      <text class="ts" x="340" y="170" text-anchor="middle" dominant-baseline="central">node.view() → node.mount() → unmount</text>
    </g>
    <path d="M220 178 L110 208" fill="none" stroke="#534AB7" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="340" y1="178" x2="340" y2="208" stroke="#534AB7" stroke-width="1" marker-end="url(#arr)"/>
    <path d="M460 178 L570 208" fill="none" stroke="#534AB7" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-teal">
      <rect x="20" y="210" width="170" height="88" rx="8" stroke-width="0.5"/>
      <text class="th" x="105" y="232" text-anchor="middle" dominant-baseline="central">home.js</text>
      <text class="ts" x="105" y="250" text-anchor="middle" dominant-baseline="central">SVG plant layout</text>
      <text class="ts" x="105" y="266" text-anchor="middle" dominant-baseline="central">subscribe → color rects</text>
      <text class="ts" x="105" y="282" text-anchor="middle" dominant-baseline="central">tooltip on hover</text>
    </g>
    <g class="c-teal">
      <rect x="205" y="210" width="270" height="88" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="232" text-anchor="middle" dominant-baseline="central">production.js</text>
      <text class="ts" x="340" y="250" text-anchor="middle" dominant-baseline="central">overview · machine_efficiency</text>
      <text class="ts" x="340" y="266" text-anchor="middle" dominant-baseline="central">STANDARD_MAP · applyStandardMap()</text>
      <text class="ts" x="340" y="282" text-anchor="middle" dominant-baseline="central">Chart.js cycle chart · OEE calc</text>
    </g>
    <g class="c-teal">
      <rect x="490" y="210" width="170" height="88" rx="8" stroke-width="0.5"/>
      <text class="th" x="575" y="232" text-anchor="middle" dominant-baseline="central">admin.js</text>
      <text class="ts" x="575" y="250" text-anchor="middle" dominant-baseline="central">PLC start/stop/write</text>
      <text class="ts" x="575" y="266" text-anchor="middle" dominant-baseline="central">alarm list + history</text>
      <text class="ts" x="575" y="282" text-anchor="middle" dominant-baseline="central">roadmap (this page)</text>
    </g>
    <line x1="340" y1="298" x2="340" y2="328" stroke="#0F6E56" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="80" y="330" width="520" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="350" text-anchor="middle" dominant-baseline="central">store.js scadaStore</text>
      <text class="ts" x="340" y="366" text-anchor="middle" dominant-baseline="central">setSnapshot · applyPlcClean · subscribe · notify</text>
      <text class="ts" x="340" y="380" text-anchor="middle" dominant-baseline="central">machines map · cycleHistory · shiftDurations · tags</text>
    </g>
    <line x1="200" y1="386" x2="160" y2="420" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="480" y1="386" x2="520" y2="420" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-blue">
      <rect x="20" y="422" width="310" height="76" rx="8" stroke-width="0.5"/>
      <text class="th" x="175" y="444" text-anchor="middle" dominant-baseline="central">productionOverviewMount()</text>
      <text class="ts" x="175" y="462" text-anchor="middle" dominant-baseline="central">KPI bar · shift columns · trend chart</text>
      <text class="ts" x="175" y="478" text-anchor="middle" dominant-baseline="central">createMachineCard / updateMachineCard</text>
      <text class="ts" x="175" y="492" text-anchor="middle" dominant-baseline="central">composite bar · formatDuration()</text>
    </g>
    <g class="c-blue">
      <rect x="350" y="422" width="310" height="76" rx="8" stroke-width="0.5"/>
      <text class="th" x="505" y="444" text-anchor="middle" dominant-baseline="central">productionMachineEfficiencyMount()</text>
      <text class="ts" x="505" y="462" text-anchor="middle" dominant-baseline="central">sidebar card · OEE row</text>
      <text class="ts" x="505" y="478" text-anchor="middle" dominant-baseline="central">updateCycleChart() — Chart.js</text>
      <text class="ts" x="505" y="492" text-anchor="middle" dominant-baseline="central">calcAvailabilityPct · calcPerformancePct</text>
    </g>
    <line x1="175" y1="498" x2="175" y2="530" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="505" y1="498" x2="505" y2="530" stroke="#185FA5" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-gray">
      <rect x="20" y="532" width="195" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="117" y="552" text-anchor="middle" dominant-baseline="central">app.js localTimer</text>
      <text class="ts" x="117" y="568" text-anchor="middle" dominant-baseline="central">+1s duration bucket each tick</text>
      <text class="ts" x="117" y="580" text-anchor="middle" dominant-baseline="central">scadaStore.notify() per second</text>
    </g>
    <g class="c-gray">
      <rect x="243" y="532" width="195" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="552" text-anchor="middle" dominant-baseline="central">REST API calls</text>
      <text class="ts" x="340" y="568" text-anchor="middle" dominant-baseline="central">/api/shift-history every 10s</text>
      <text class="ts" x="340" y="580" text-anchor="middle" dominant-baseline="central">/api/plc/status on demand</text>
    </g>
    <g class="c-gray">
      <rect x="466" y="532" width="195" height="56" rx="8" stroke-width="0.5"/>
      <text class="th" x="563" y="552" text-anchor="middle" dominant-baseline="central">WebSocket msgs</text>
      <text class="ts" x="563" y="568" text-anchor="middle" dominant-baseline="central">plc_snapshot on connect</text>
      <text class="ts" x="563" y="580" text-anchor="middle" dominant-baseline="central">plc_clean on PLC event</text>
    </g>
    <line x1="117" y1="588" x2="117" y2="618" stroke="#5F5E5A" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="340" y1="588" x2="340" y2="618" stroke="#5F5E5A" stroke-width="1" marker-end="url(#arr)"/>
    <line x1="563" y1="588" x2="563" y2="618" stroke="#5F5E5A" stroke-width="1" marker-end="url(#arr)"/>
    <g class="c-gray">
      <rect x="60" y="620" width="560" height="32" rx="8" stroke-width="0.5"/>
      <text class="th" x="340" y="636" text-anchor="middle" dominant-baseline="central">browser DOM — cards · shift grid · charts · plant SVG</text>
    </g>
  </svg>`;

  // ── File reference table ────────────────────────────────────────────────
  const fileTable = [
    { layer: 'Python',  file: 'plc_service.py',       role: 'TCP server, receives start/stop/write commands from Node' },
    { layer: 'Python',  file: 'plc_loop.py',           role: 'Reads PLC every 0.3s, fans data to worker queues' },
    { layer: 'Python',  file: 'utils/clean_data.py',   role: 'Parses raw bits+words into structured dicts per department' },
    { layer: 'Python',  file: 'utils/db_writer.py',    role: 'Flattens event dicts and INSERTs into raw_* tables' },
    { layer: 'Python',  file: 'utils/db_connector.py', role: 'Creates pymysql connection pool, shared across workers' },
    { layer: 'Node',    file: 'server.js',              role: 'Bootstrap: hydrate → engines → WS → python bridge → listen' },
    { layer: 'Node',    file: 'pythonBridge.js',        role: 'TCP client to Python; routes heartbeat + plc_clean messages' },
    { layer: 'Node',    file: 'plcEngine.js',           role: 'processUpdate(): derive status, merge tags, cycleHistory' },
    { layer: 'Node',    file: 'stateStore.js',          role: 'In-memory machines map; deriveStatus; loadState/saveState' },
    { layer: 'Node',    file: 'shiftEngine.js',         role: 'Shift boundary detection, open/close shift, schedule rollover' },
    { layer: 'Node',    file: 'bootstrapEngine.js',     role: 'On startup: load last row + shiftDurations + cycleHistory' },
    { layer: 'Node',    file: 'persistenceEngine.js',   role: '1s duration ticker; 30s auto-save to machine_shift_status' },
    { layer: 'Node',    file: 'plcMonitor.js',          role: 'WebSocket server; broadcast() to all connected clients' },
    { layer: 'Node',    file: 'alarmService.js',        role: 'raise/clear/ack alarms; broadcast alarm_event over WS' },
    { layer: 'Node',    file: 'logService.js',          role: 'Append-only scada.log; in-memory ALARM cache for admin view' },
    { layer: 'Node',    file: 'routes/api/plc.js',      role: 'POST /start /stop /write → pythonBridge; admin only' },
    { layer: 'Node',    file: 'routes/shiftHistory.js', role: 'GET /api/shift-history — last 18 shifts from DB' },
    { layer: 'Frontend',file: 'app.js',                 role: 'bootstrap, navigate(), WS init, localTimer, auth check' },
    { layer: 'Frontend',file: 'store.js',               role: 'scadaStore: setSnapshot, applyPlcClean, subscribe/notify' },
    { layer: 'Frontend',file: 'views/home.js',          role: 'SVG plant floor; subscribe → color machine rects + tooltip' },
    { layer: 'Frontend',file: 'views/production.js',    role: 'Overview cards, shift panel, machine efficiency + OEE chart' },
    { layer: 'Frontend',file: 'views/admin.js',         role: 'PLC control, alarm panel, audit log, this roadmap page' },
  ];

  const layerColors = {
    Python:   { bg: '#FAEEDA', text: '#633806', border: '#BA7517' },
    Node:     { bg: '#E6F1FB', text: '#0C447C', border: '#378ADD' },
    Frontend: { bg: '#EEEDFE', text: '#3C3489', border: '#534AB7' },
  };

  // ── Render page ─────────────────────────────────────────────────────────
  page.style.cssText = 'font-family: sans-serif; color: var(--color-text-primary);';

  // header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;';
  header.innerHTML = `
    <div>
      <div style="font-size:20px;font-weight:500;">Project roadmap</div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;">SCADA.SET — system architecture, data flow and file reference</div>
    </div>
    <div style="font-size:11px;color:var(--color-text-tertiary);">v1.0 · ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
  `;
  page.appendChild(header);

  // tab bar
  const tabs = [
    { id: 'arch',     label: 'System architecture' },
    { id: 'flow',     label: 'Data flow' },
    { id: 'frontend', label: 'Frontend routing' },
    { id: 'files',    label: 'File reference' },
  ];

  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:4px;border-bottom:1px solid var(--color-border-tertiary);margin-bottom:20px;';

  const panels = {};
  tabs.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.dataset.tab = t.id;
    btn.style.cssText = `background:none;border:none;border-bottom:2px solid transparent;
      padding:8px 14px;font-size:13px;cursor:pointer;color:var(--color-text-secondary);
      margin-bottom:-1px;transition:color .15s,border-color .15s;`;
    tabBar.appendChild(btn);

    const panel = document.createElement('div');
    panel.dataset.panel = t.id;
    panel.style.display = i === 0 ? 'block' : 'none';
    panels[t.id] = { btn, panel };
  });

  page.appendChild(tabBar);

  // activate tab
  function activateTab(id) {
    tabs.forEach(t => {
      const { btn, panel } = panels[t.id];
      const active = t.id === id;
      btn.style.color = active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
      btn.style.borderBottomColor = active ? 'var(--color-border-info)' : 'transparent';
      btn.style.fontWeight = active ? '500' : '400';
      panel.style.display = active ? 'block' : 'none';
    });
  }

  tabBar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) activateTab(btn.dataset.tab);
  });

  activateTab('arch');

  // panel: architecture
  const archPanel = panels['arch'].panel;
  archPanel.innerHTML = svgArchitecture;
  page.appendChild(archPanel);

  // panel: data flow
  const flowPanel = panels['flow'].panel;
  flowPanel.innerHTML = svgDataFlow;
  page.appendChild(flowPanel);

  // panel: frontend routing
  const fePanel = panels['frontend'].panel;
  fePanel.innerHTML = svgFrontend;
  page.appendChild(fePanel);

  // panel: file reference
  const filePanel = panels['files'].panel;
  filePanel.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
  table.innerHTML = `
    <thead>
      <tr style="border-bottom:1px solid var(--color-border-tertiary);">
        <th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--color-text-secondary);width:80px;">Layer</th>
        <th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--color-text-secondary);width:220px;">File</th>
        <th style="text-align:left;padding:8px 12px;font-weight:500;color:var(--color-text-secondary);">Role</th>
      </tr>
    </thead>
    <tbody>
      ${fileTable.map((r, i) => {
        const c = layerColors[r.layer];
        return `<tr style="border-bottom:1px solid var(--color-border-tertiary);background:${i%2===0?'transparent':'var(--color-background-secondary)'};">
          <td style="padding:7px 12px;">
            <span style="background:${c.bg};color:${c.text};border:0.5px solid ${c.border};
              font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;">${r.layer}</span>
          </td>
          <td style="padding:7px 12px;font-family:monospace;font-size:11px;color:var(--color-text-primary);">${r.file}</td>
          <td style="padding:7px 12px;color:var(--color-text-secondary);">${r.role}</td>
        </tr>`;
      }).join('')}
    </tbody>
  `;
  filePanel.appendChild(table);
  page.appendChild(filePanel);
}
export function adminRoadmapUnmount() {

}




