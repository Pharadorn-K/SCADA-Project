// frontend/public/js/sidebar.js
export function renderSidebar(role) {
  return `
    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <a data-page="home">🏠 <span>Home</span></a>
        <a data-page="production">🏭 <span>Production</span></a>
        <a data-page="maintenance">🛠 <span>Maintenance</span></a>

      </div>

      ${role === 'admin' ? `
      <div class="sidebar-section">
        <a data-page="admin">⚙ <span>Admin</span></a>
      </div>` : ''}
    </nav>
  `;
}
{/* <a href="#" data-page="home">🏠 Home</a>  
<a href="#" data-page="production">🏭 Production</a>
<a href="#" data-page="maintenance">🛠 Maintenance</a>
<a href="#" data-page="admin">⚙ Admin</a> */}