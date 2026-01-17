// frontend/public/js/views/production.js
export function productionView() {
  return `
    <h2>🏭 Production Monitoring</h2>

    <div class="card">
      <h3>📡 Live PLC Data</h3>
      <pre id="plc-data">No data...</pre>
    </div>

    <div class="card">
      <h3>🚨 Active Alarms</h3>
      <ul id="alarm-list" class="alarm-list"></ul>
    </div>
  `;
}
import { scadaStore } from '../store.js';

let unsubscribe = null;
let alarmTimer = null;

export async function productionMount() {
  const dataEl = document.getElementById('plc-data');
  const alarmList = document.getElementById('alarm-list');
  alarmList.onclick = async (e) => {
    if (!e.target.classList.contains('ack-btn')) return;

    const id = e.target.dataset.id;

    await fetch(`/api/alarms/ack/${id}`, {
      method: 'POST',
      credentials: 'same-origin'
    });

    loadAlarms();
  };

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });

  async function loadAlarms() {
    const res = await fetch('/api/alarms', {
      credentials: 'same-origin'
    });

    if (!res.ok) {
      console.warn('Alarm fetch failed:', res.status);
      alarmList.innerHTML = '<li>No alarm access</li>';
      return;
    }

    const alarms = await res.json();

    if (!Array.isArray(alarms)) {
      console.warn('Alarm response not array:', alarms);
      return;
    }

  alarmList.innerHTML = alarms
    .slice()
    .reverse()
    .map(a => `
      <li class="alarm ${a.severity.toLowerCase()} ${a.acknowledged ? 'ack' : ''}">
        <strong>${a.code}</strong>
        <span>${a.message}</span>
        <small display="float:right">${new Date(a.time).toLocaleTimeString()}</small>
        ${
          a.acknowledged
            ? `<small>✔ ACK by ${a.ackBy}</small>`
            : `<button data-id="${a.id}" class="ack-btn">ACK</button>`
        }
      </li>
    `)
  .join('');
  }

  await loadAlarms();
  alarmTimer = setInterval(loadAlarms, 2000);
}

export function productionUnmount() {
  if (unsubscribe) unsubscribe();
  if (alarmTimer) clearInterval(alarmTimer);
}

// export function productionView() {
//   return `
//     <h2>🏭 Production Monitoring</h2>

//     <div class="card">
//       <strong>Status:</strong>
//       <span id="plc-badge" class="badge badge-gray">UNKNOWN</span>
//     </div>

//     <div class="card">
//       <button id="btn-start">▶️ Start</button>
//       <button id="btn-stop">⏹️ Stop</button>
//       <input id="write-tag" placeholder="Tag" value="B10">
//       <input id="write-value" type="number" value="1">
//       <button id="btn-write">✍️ Write</button>
//     </div>

//     <div class="card">
//       <pre id="plc-data">No data...</pre>
//     </div>
//   `;
// }


// import { sendPlcCommand } from '../api.js';
// import { scadaStore } from '../store.js';

// let unsubscribe = null;

// async function refreshPlcStatus() {
//   const res = await fetch('/api/plc/status', {
//     credentials: 'same-origin'
//   });
//   return res.json();
// }

// function updateUIFromStatus(status) {
//   const badge = document.getElementById('plc-badge');
//   const btnStart = document.getElementById('btn-start');
//   const btnStop = document.getElementById('btn-stop');

//   if (!status.connected && status.running) {
//     badge.textContent = 'PLC FAULT';
//     badge.className = 'badge badge-red';
//     btnStart.disabled = true;
//     btnStop.disabled = false;
//   }
//   else if (!status.connected) {
//     badge.textContent = 'DISCONNECTED';
//     badge.className = 'badge badge-gray';
//     btnStart.disabled = true;
//     btnStop.disabled = true;
//   }
//   else if (status.running && !status.healthy) {
//     badge.textContent = 'PLC FAULT';
//     badge.className = 'badge badge-red';
//     btnStart.disabled = true;
//     btnStop.disabled = false;
//   }
//   else if (status.running) {
//     badge.textContent = 'RUNNING';
//     badge.className = 'badge badge-green';
//     btnStart.disabled = true;
//     btnStop.disabled = false;
//   }
//   else {
//     badge.textContent = 'STOPPED';
//     badge.className = 'badge badge-red';
//     btnStart.disabled = false;
//     btnStop.disabled = true;
//   }
// }


// export async function productionMount() {
//   const dataEl = document.getElementById('plc-data');

//   // Subscribe to live PLC data
//   unsubscribe = scadaStore.subscribe((data) => {
//     dataEl.textContent = JSON.stringify(data, null, 2);
//   });

//   // Initial status fetch
//   const status = await refreshPlcStatus();
//   updateUIFromStatus(status);

//   document.getElementById('btn-start').addEventListener('click', async () => {
//     await sendPlcCommand('start');
//     const status = await refreshPlcStatus();
//     updateUIFromStatus(status);
//   });

//   document.getElementById('btn-stop').addEventListener('click', async () => {
//     await sendPlcCommand('stop');
//     const status = await refreshPlcStatus();
//     updateUIFromStatus(status);
//   });

//   document.getElementById('btn-write').addEventListener('click', () => {
//     const tag = document.getElementById('write-tag').value;
//     const value = parseInt(document.getElementById('write-value').value);
//     sendPlcCommand('write', { tag, value });
//   });
// }

// export function productionUnmount() {
//   if (unsubscribe) {
//     unsubscribe();
//     unsubscribe = null;
//   }
// }
