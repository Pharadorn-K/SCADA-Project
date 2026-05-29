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
    <div class="h-pd-overview"><h1>Admin panel</h1></div>

    <div class="adm-control-bar">
      <div class="adm-status-group">
        <span class="adm-status-label">PLC status</span>
        <span id="plc-badge" class="badge badge-gray">UNKNOWN</span>
      </div>
      <div class="adm-btn-group">
        <button id="btn-start" class="adm-btn adm-btn-green">Start</button>
        <button id="btn-stop"  class="adm-btn adm-btn-red">Stop</button>
      </div>
      <div class="adm-write-group">
        <input id="write-tag"   class="adm-input" placeholder="Tag e.g. B10" value="B10"/>
        <input id="write-value" class="adm-input adm-input-sm" type="number" value="1"/>
        <button id="btn-write"  class="adm-btn">Write tag</button>
      </div>
    </div>

    <div class="adm-panels">

      <div class="adm-panel">
        <div class="adm-panel-head">
          <span class="adm-panel-title">Active alarms</span>
          <div class="adm-filter-row">
            <label class="adm-filter-label">Range</label>
            <select id="alarm-range" class="adm-select">
              <option value="15">Last 15 min</option>
              <option value="30">Last 30 min</option>
              <option value="60" selected>Last 1 hr</option>
              <option value="480">Last 8 hrs</option>
              <option value="1440">Last 24 hrs</option>
            </select>
          </div>
        </div>
        <ul id="alarm-list" class="adm-alarm-list"></ul>
      </div>

      <div class="adm-panel">
        <div class="adm-panel-head">
          <span class="adm-panel-title">Alarm history</span>
          <div class="adm-filter-row">
            <input type="date" id="hist-from" class="adm-input adm-input-date"/>
            <span class="adm-filter-label">to</span>
            <input type="date" id="hist-to"   class="adm-input adm-input-date"/>
            <label class="adm-check-label">
              <input type="checkbox" id="hist-today" checked/>
              Today
            </label>
          </div>
        </div>
        <ul id="alarm-history" class="adm-alarm-list"></ul>
      </div>

    </div>
    <div class="adm-panel adm-sessions-panel">
      <div class="adm-panel-head">
        <span class="adm-panel-title">Active sessions</span>
        <span id="session-count" class="adm-tag adm-tag-info">0 online</span>
      </div>
      <div id="session-list" class="adm-session-list"></div>
    </div>

    <div class="adm-panel adm-sessions-panel" style="margin-top:14px" id="users-panel">
      <div class="adm-panel-head">
        <span class="adm-panel-title">User management</span>
        <div style="display:flex;gap:6px;align-items:center">
          <select id="invite-role" class="adm-select">
            <option value="operator">operator</option>
            <option value="supervisor">supervisor</option>
          </select>
          <button class="adm-btn adm-btn-green" id="btn-invite">Generate invite</button>
        </div>
      </div>
      <div id="invite-result" style="padding:6px 14px;font-size:11px;color:#185FA5;word-break:break-all;min-height:20px"></div>
      <div id="user-list" style="padding:6px 8px;display:flex;flex-direction:column;gap:4px"></div>
    </div>
  `;
}
export async function adminAlarmMount() {
  const status = await refreshPlcStatus();
  updateUIFromStatus(status);

  // ── PLC controls ──────────────────────────────────────────────────────
  document.getElementById('btn-start').addEventListener('click', async () => {
    await sendPlcCommand('start');
    updateUIFromStatus(await refreshPlcStatus());
  });

  document.getElementById('btn-stop').addEventListener('click', async () => {
    await sendPlcCommand('stop');
    updateUIFromStatus(await refreshPlcStatus());
  });

  document.getElementById('btn-write').addEventListener('click', () => {
    const tag   = document.getElementById('write-tag').value.trim();
    const value = parseInt(document.getElementById('write-value').value);
    if (!tag) return;
    sendPlcCommand('write', { tag, value });
  });

  // ── Active alarms ─────────────────────────────────────────────────────
  async function loadActiveAlarms() {
    const rangeMin = document.getElementById('alarm-range')?.value || 60;
    const since    = Date.now() - rangeMin * 60 * 1000;
    const listEl   = document.getElementById('alarm-list');

    // /api/alarms returns the live alarmService array with acknowledged field
    const res = await fetch('/api/alarms', { credentials: 'same-origin' });
    if (!res.ok) { listEl.innerHTML = '<li class="adm-empty">No access</li>'; return; }

    const alarms = await res.json();

    // filter by time window — alarm.id is a timestamp (Date.now())
    const filtered = alarms
      .filter(a => a.id >= since)
      .sort((a, b) => b.id - a.id);

    if (!filtered.length) {
      listEl.innerHTML = '<li class="adm-empty">No alarms in this range</li>';
      return;
    }

    listEl.innerHTML = filtered.map(a => `
      <li class="adm-alarm-item sev-${a.severity.toLowerCase()}">
        <div class="adm-alarm-main">
          <span class="adm-alarm-code">${a.code}</span>
          <span class="adm-alarm-msg">${a.message}</span>
          <span class="adm-alarm-time">${new Date(a.id).toLocaleTimeString()}</span>
        </div>
        <div class="adm-alarm-meta">
          ${a.cleared
            ? `<span class="adm-tag adm-tag-cleared">Cleared ${new Date(a.clearTime).toLocaleTimeString()}</span>`
            : `<span class="adm-tag adm-tag-active">Active</span>`
          }
          ${a.acknowledged
            ? `<span class="adm-tag adm-tag-acked">Acked by ${a.ackBy}</span>`
            : `<button class="adm-ack-btn" data-id="${a.id}">Acknowledge</button>`
          }
        </div>
      </li>
    `).join('');
  }

  // Ack click — delegate on the list
  document.getElementById('alarm-list').addEventListener('click', async e => {
    const btn = e.target.closest('.adm-ack-btn');
    if (!btn) return;
    await fetch(`/api/alarms/ack/${btn.dataset.id}`, {
      method: 'POST',
      credentials: 'same-origin'
    });
    loadActiveAlarms();
  });

  document.getElementById('alarm-range').addEventListener('change', loadActiveAlarms);

  // ── Alarm history ─────────────────────────────────────────────────────
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  // initialise date pickers to today
  const fromEl    = document.getElementById('hist-from');
  const toEl      = document.getElementById('hist-to');
  const todayChk  = document.getElementById('hist-today');
  fromEl.value    = todayISO();
  toEl.value      = todayISO();

  todayChk.addEventListener('change', () => {
    if (todayChk.checked) {
      fromEl.value      = todayISO();
      toEl.value        = todayISO();
      fromEl.disabled   = true;
      toEl.disabled     = true;
    } else {
      fromEl.disabled   = false;
      toEl.disabled     = false;
    }
    loadHistory();
  });

  // lock pickers when today is checked on mount
  fromEl.disabled = true;
  toEl.disabled   = true;

  fromEl.addEventListener('change', loadHistory);
  toEl.addEventListener('change',   loadHistory);

  async function loadHistory() {
    const histEl = document.getElementById('alarm-history');
    const from   = fromEl.value ? new Date(fromEl.value + 'T00:00:00').toISOString() : null;
    const to     = toEl.value   ? new Date(toEl.value   + 'T23:59:59').toISOString() : null;

    const params = new URLSearchParams({ limit: 200 });
    if (from) params.set('from', from);
    if (to)   params.set('to',   to);

    const res = await fetch(`/api/alarm-history?${params}`, { credentials: 'same-origin' });
    if (!res.ok) { histEl.innerHTML = '<li class="adm-empty">No access</li>'; return; }

    const logs = await res.json();

    if (!logs.length) {
      histEl.innerHTML = '<li class="adm-empty">No history in this range</li>';
      return;
    }

    histEl.innerHTML = [...logs].reverse().map(l => `
      <li class="adm-alarm-item sev-${l.severity.toLowerCase()}">
        <div class="adm-alarm-main">
          <span class="adm-alarm-code">${l.code ?? '--'}</span>
          <span class="adm-alarm-msg">${l.message}</span>
          <span class="adm-alarm-time">${new Date(l.ts).toLocaleString()}</span>
        </div>
      </li>
    `).join('');
  }

  // ── WebSocket — auto-refresh both panels on new alarm ─────────────────
  const ws = scadaStore.ws;

  ws.addEventListener('message', handleAlarmWs);

  // store cleanup ref
  adminAlarmMount._wsCleanup = () => ws.removeEventListener('message', handleAlarmWs);
  // inside adminAlarmMount(), add after the WS handler setup:

  // ── Sessions ──────────────────────────────────────────────────────────
  async function loadSessions() {
    const res = await fetch('/api/auth/sessions', { credentials: 'same-origin' });
    if (!res.ok) return;
    renderSessions(await res.json());
  }

  function renderSessions(sessions) {
    const listEl   = document.getElementById('session-list');
    const countEl  = document.getElementById('session-count');
    if (!listEl) return;

    countEl.textContent = `${sessions.length} online`;

    if (!sessions.length) {
      listEl.innerHTML = '<div class="adm-empty">No active sessions</div>';
      return;
    }

    const now = Date.now();

    listEl.innerHTML = sessions.map(s => {
      const loginAgo    = formatSessionAge(now - s.loginAt);
      const idleMs      = now - s.lastSeenAt;
      const idleSec     = Math.floor(idleMs / 1000);
      const isLong      = s.loginAt && (now - s.loginAt) > (8 * 3600 * 1000);
      const isIdle      = idleSec > 300; // idle > 5 min
      const idleLabel   = formatSessionAge(idleMs);

      return `
        <div class="adm-session-row ${isLong ? 'session-long' : ''} ${isIdle ? 'session-idle' : ''}">
          <div class="adm-session-avatar">${s.userId.slice(0,2).toUpperCase()}</div>
          <div class="adm-session-info">
            <div class="adm-session-name">
              ${s.userId}
              <span class="adm-tag ${s.role === 'admin' ? 'adm-tag-admin' : 'adm-tag-op'}">${s.role}</span>
              ${isLong ? '<span class="adm-tag adm-tag-warn">Long session</span>' : ''}
            </div>
            <div class="adm-session-meta">
              Logged in ${loginAgo} ago
              &nbsp;·&nbsp;
              ${isIdle
                ? `<span style="color:#BA7517">Idle ${idleLabel}</span>`
                : `Active ${idleLabel} ago`
              }
            </div>
          </div>
          <div class="adm-session-dot ${isIdle ? 'dot-idle' : 'dot-active'}"></div>
        </div>
      `;
    }).join('');
  }

  function formatSessionAge(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)   return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)   return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ${m % 60}m`;
    return `${Math.floor(h / 24)}d`;
  }

  // wire WS session updates into the existing handler:
  // replace the handleAlarmWs function with:
  function handleAlarmWs(event) {
    const msg = JSON.parse(event.data);
    if (msg.type === 'alarm_event') {
      loadActiveAlarms();
      loadHistory();
    }
    if (msg.type === 'session_update') {
      renderSessions(msg.sessions);
    }
  }
  // ADD at the end of adminAlarmMount(), before the closing brace:

  // ── User management ──────────────────────────────────────────────────────
  async function loadUsers() {
    const res = await fetch('/api/auth/users', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const listEl = document.getElementById('user-list');
    if (!listEl) return;

    const ROLE_COLOR = { admin: '#3C3489', supervisor: '#854F0B', operator: '#0C447C' };
    const ROLE_BG    = { admin: '#EEEDFE', supervisor: '#FAEEDA', operator: '#E6F1FB' };

    listEl.innerHTML = data.users.map(u => `
      <div class="adm-session-row">
        <div class="adm-session-avatar">${u.username.slice(0,2).toUpperCase()}</div>
        <div class="adm-session-info">
          <div class="adm-session-name">
            ${u.display_name || u.username}
            <span class="adm-tag" style="background:${ROLE_BG[u.role]};color:${ROLE_COLOR[u.role]}">${u.role}</span>
            ${!u.active ? '<span class="adm-tag" style="background:#f1efe8;color:#888">inactive</span>' : ''}
            ${u.must_change_password ? '<span class="adm-tag adm-tag-warn">must change pw</span>' : ''}
          </div>
          <div class="adm-session-meta">@${u.username} · joined ${new Date(u.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="adm-btn" style="padding:3px 9px;font-size:10px"
            onclick="adminResetPw('${u.username}')">Reset pw</button>
          <button class="adm-btn ${u.active ? 'adm-btn-red' : 'adm-btn-green'}" style="padding:3px 9px;font-size:10px"
            onclick="adminToggleActive('${u.username}', ${u.active ? 0 : 1})">${u.active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>
    `).join('');
  }

  window.adminResetPw = async (username) => {
    const newPw = prompt(`Reset password for "${username}"\nEnter a temporary password (min 8 chars):`);
    if (!newPw || newPw.length < 8) { alert('Password too short'); return; }
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, newPassword: newPw })
    });
    const data = await res.json();
    alert(data.success ? `Password reset. User must change it on next login.` : (data.message || 'Failed'));
    if (data.success) loadUsers();
  };

  window.adminToggleActive = async (username, active) => {
    const res = await fetch(`/api/auth/users/${username}`, {
      method: 'PATCH', credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ active })
    });
    const data = await res.json();
    if (data.success) loadUsers();
    else alert(data.message || 'Failed');
  };

  document.getElementById('btn-invite')?.addEventListener('click', async () => {
    const role = document.getElementById('invite-role').value;
    const res  = await fetch('/api/auth/invites', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    const el   = document.getElementById('invite-result');
    if (data.success) {
      el.innerHTML = `<strong>Invite token (${role}, valid 24h):</strong><br><code style="font-size:10px;word-break:break-all;user-select:all">${data.token}</code>`;
    } else {
      el.textContent = data.message || 'Failed to create invite';
    }
  });

  await loadUsers();
  // initial load
  await loadSessions();
  await loadActiveAlarms();
  await loadHistory();
}

export function adminAlarmUnmount() {
  if (adminAlarmMount._wsCleanup) {
    adminAlarmMount._wsCleanup();
    delete adminAlarmMount._wsCleanup;
    delete window.adminResetPw;
    delete window.adminToggleActive;
  }

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
    btn.className = 'rm-tab';
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
  archPanel.innerHTML = `<div class="rm-svg">${svgArchitecture}</div>`;// svgArchitecture;
  page.appendChild(archPanel);

  // panel: data flow
  const flowPanel = panels['flow'].panel;
  flowPanel.innerHTML = `<div class="rm-svg">${svgDataFlow}</div>`;// svgDataFlow;
  page.appendChild(flowPanel);

  // panel: frontend routing
  const fePanel = panels['frontend'].panel;
  fePanel.innerHTML = `<div class="rm-svg">${svgFrontend}</div>`;//svgFrontend;
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




