// frontend/public/js/sidebar.js
export function renderSidebar(role) {
  return `
  <div class="sidebar-header">
    <button class="toggle-sidebar" id="toggleSidebar">
      <i class="fa-solid fa-angles-left" id="toggleIcon"></i>
    </button>
  </div>

  <div id="leftside-navigation">
    <ul class="nano-content">

      <li>
        <a data-page="home" data-title="Home">
          <i class="fa-regular fa-house"></i><span>Home</span>
        </a>
      </li>

      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Production">
          <i class="fa fa-chart-pie"></i><span>Production</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>
        <ul>
          <li><a data-page="production.overview">Overview</a></li>
          <li><a data-page="production.machine_efficiency">Machine efficiency</a></li>
          <li><a data-page="production.production_history">Production History</a></li>
          <li><a data-page="production.staff_management">Staff management</a></li>
        </ul>
      </li>

      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Maintenance">
          <i class="fa fa-toolbox"></i><span>Maintenance</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>

        <ul>
          <li class="sub-menu">
            <a href="javascript:void(0);" data-title="Overview machine">
              <span>Overview machine</span>
              <i class="arrow fa fa-angle-right"></i>
            </a>

            <ul>
              <li><a data-page="maintenance.overview.plant1">Plant 1</a></li>
              <li><a data-page="maintenance.overview.plant2">Plant 2</a></li>
            </ul>
          </li>

          <li><a data-page="maintenance.request">Maintenance request</a></li>
          <li><a data-page="maintenance.report">Report</a></li>
        </ul>
      </li>

      ${role === 'admin' ? `
      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Admin">
          <i class="fa fa-computer"></i><span>Admin</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>
        <ul>
          <li><a data-page="admin.alarm">Alarm Handle</a></li>
          <li><a data-page="admin.database">Database</a></li>
          <li><a data-page="admin.roadmap">Project roadmap</a></li>
        </ul>
      </li>` : ''}

    </ul>
  </div>
  `;
}
