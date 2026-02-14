// frontend/public/js/views/home.js
import { scadaStore } from '../store.js';
let unsubscribe = null;

export function homeView() {
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


export async function homeMount() {
  const dataEl = document.getElementById('plc-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });
}

export function homeUnmount() {
  if (unsubscribe) unsubscribe();
}


