// frontend/public/js/sidebar.js
export function renderSidebar(role) {
  return `
    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <a data-page="home"><i class="fa-solid fa-display"></i></i> <span>Home</span></a>
        <a data-page="production"><i class="fa-solid fa-industry"></i> <span>Production</span></a>
        <a data-page="maintenance"><i class="fa-solid fa-screwdriver-wrench"></i> <span>Maintenance</span></a>

      </div>

      ${role === 'admin' ? `
      <div class="sidebar-section">
        <a data-page="admin"><i class="fa-solid fa-laptop-code"></i><span>    Admin</span></a>
      </div>` : ''}
    </nav>
  `;
}
