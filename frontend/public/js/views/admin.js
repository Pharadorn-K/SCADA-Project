// frontend/public/js/views/admin.js
export function adminView() {
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

export async function adminMount() {
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

export function adminUnmount() {
  if (alarmTimer) clearInterval(alarmTimer);
}
