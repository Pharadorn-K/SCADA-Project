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

  function handleAlarmEvent(msg) {
    if (msg.type !== 'alarm_event') return;
    loadAlarms(); // re-render list instantly
  }

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
  const ws = scadaStore.ws;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    handleAlarmEvent(msg);
  });
  await loadAlarms();
  // alarmTimer = setInterval(loadAlarms, 2000);
}

export function productionUnmount() {
  if (unsubscribe) unsubscribe();
  if (alarmTimer) clearInterval(alarmTimer);
}

