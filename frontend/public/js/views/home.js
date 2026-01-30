// frontend/public/js/views/home.js
export function homeView() {
  return `
      <h1>🏭 SCADA Dashboard – Home</h1>
      <div class="card">
        <p>Welcome to the SCADA system.</p>
        <p>Use navigation above to switch views.</p>
        <div class="card">
          <h3>📡 Live PLC Data</h3>
          <pre id="status-data">No data...</pre>
        </div>
      </div>
  `;
}


import { scadaStore } from '../store.js';

let unsubscribe = null;

export function homeMount() {
  const dataEl = document.getElementById('status-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });

}

export function homeUnmount() {
  if (unsubscribe) unsubscribe();
}


