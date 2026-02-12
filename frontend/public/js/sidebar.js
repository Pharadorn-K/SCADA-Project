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
          <i class="fa fa-dashboard"></i><span>Home</span>
        </a>
      </li>

      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Production">
          <i class="fa fa-table"></i><span>Production</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>
        <ul>
          <li><a data-page="production.history">History</a></li>
          <li><a data-page="production.press">Press</a></li>
          <li><a data-page="production.heat">Heat</a></li>
          <li><a data-page="production.lathe">Lathe</a></li>
        </ul>
      </li>

      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Maintenance">
          <i class="fa fa-tasks"></i><span>Maintenance</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>

        <ul>
          <li class="sub-menu">
            <a href="javascript:void(0);" data-title="Overview machine">
              <i class="fa fa-desktop"></i><span>Overview machine</span>
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

      <li>
        <a data-page="oee" data-title="OEE">
          <i class="fa fa-line-chart"></i><span>OEE</span>
        </a>
      </li>

      ${role === 'admin' ? `
      <li class="sub-menu">
        <a href="javascript:void(0);" data-title="Admin">
          <i class="fa fa-cog"></i><span>Admin</span>
          <i class="arrow fa fa-angle-right"></i>
        </a>
        <ul>
          <li><a data-page="admin.alarm">Alarm Handle</a></li>
          <li><a data-page="admin.database">Database</a></li>
        </ul>
      </li>` : ''}

    </ul>
  </div>
  `;
}
