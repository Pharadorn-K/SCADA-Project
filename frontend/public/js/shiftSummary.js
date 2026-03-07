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

  data.departments.forEach(dept => {

    const deptPercent = (dept.availability * 100).toFixed(2);

    const deptDiv = document.createElement('div');
    deptDiv.className = 'department-block';

    deptDiv.innerHTML = `
      <h3>${dept.department} - ${deptPercent}%</h3>
    `;

    dept.machines.forEach(machine => {

      const percent = (machine.availability * 100).toFixed(2);

      const row = document.createElement('div');
      row.innerHTML = `
        ${machine.machine}
        | Run: ${machine.run_seconds}s
        | Idle: ${machine.idle_seconds}s
        | Alarm: ${machine.alarm_seconds}s
        | ${percent}%
      `;

      deptDiv.appendChild(row);
    });

    container.appendChild(deptDiv);
  });

  // 🔥 Total factory
  const totalPercent = (data.totalAvailability * 100).toFixed(2);

  const totalDiv = document.createElement('h2');
  totalDiv.innerHTML = `Factory Availability: ${totalPercent}%`;

  container.prepend(totalDiv);
}