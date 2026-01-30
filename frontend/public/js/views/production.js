// frontend/public/js/views/production.js
// export function productionView() {
//   return `
//     <h2>🏭 Production Monitoring</h2>

//     <div class="card">
//       <h3>📡 Live PLC Data</h3>
//       <pre id="plc-data">No data...</pre>
//     </div>

//   `;
// }
export function productionHistoryView() {
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

export function productionPressView() {
  return `
    <div class="card">
      <h2>Press Dashboard</h2>
    </div>
  `;
}

export function productionHeatView() {
  return `
    <div class="card">
      <h2>Heat Process</h2>
    </div>
  `;
}

export function productionLatheView() {
  return `
    <div class="card">
      <h2>Lathe Dashboard</h2>
    </div>
  `;
}

import { scadaStore } from '../store.js';

let unsubscribe = null;

export async function productionHistoryMount() {
  const dataEl = document.getElementById('plc-data');

  // PLC live data
  unsubscribe = scadaStore.subscribe((data) => {
    dataEl.textContent = JSON.stringify(data, null, 2);
  });

}

export function productionHistoryUnmount() {
  if (unsubscribe) unsubscribe();
}

