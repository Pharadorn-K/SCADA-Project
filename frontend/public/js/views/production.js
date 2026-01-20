// frontend/public/js/views/production.js
export function productionView() {
  return `
    <h2>🏭 Production Monitoring</h2>

    <div class="card">
      <h3>📡 Live PLC Data</h3>
      <pre id="plc-data">No data...</pre>
    </div>

  `;
}
import { scadaStore } from '../store.js';

let unsubscribe = null;

export async function productionMount() {
  const dataEl = document.getElementById('plc-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });

}

export function productionUnmount() {
  if (unsubscribe) unsubscribe();
}

