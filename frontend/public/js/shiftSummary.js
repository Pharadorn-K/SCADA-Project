// frontend/public/js/shiftSummary.js
async function loadShiftSummary(date, shift = null) {

  let url = `/api/shift-summary?date=${date}`;

  if (shift) {
    url += `&shift=${shift}`;
  }

  const res = await fetch(url);
  const json = await res.json();

  if (!json.success) {
    console.error('Failed to load shift summary');
    return;
  }

  renderShiftSummary(json.data);
}

function renderShiftSummary(data) {

  const container = document.getElementById('shiftSummaryTable');
  container.innerHTML = '';

  data.forEach(row => {

    const percent = (row.availability * 100).toFixed(2);

    const div = document.createElement('div');
    div.className = 'shift-row';

    div.innerHTML = `
      <strong>${row.department.toUpperCase()}</strong> -
      ${row.machine}
      | Run: ${row.run_seconds}s
      | Idle: ${row.idle_seconds}s
      | Alarm: ${row.alarm_seconds}s
      | Availability: <span class="availability">${percent}%</span>
    `;

    container.appendChild(div);
  });
}