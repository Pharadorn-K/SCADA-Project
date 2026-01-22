// frontend/public/js/app.js
import { homeView, homeMount, homeUnmount } from './views/home.js';
import { productionView, productionMount, productionUnmount } from './views/production.js';
import { maintenanceView, maintenanceMount, maintenanceUnmount } from './views/maintenance.js';
import { adminView, adminMount, adminUnmount } from './views/admin.js';

let currentUnmount = null;
let currentUserRole = null;


// Auth check
async function checkAuth() {
  const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
  const auth = await res.json();
  if (!auth.authenticated) {
    window.location.href = '/login.html';
    return false;
  }
  currentUserRole = auth.role;
  renderNav();
  return true;
}


function renderNav() {
  const nav = document.getElementById('main-nav');

  // Build nav HTML with data-page
  let navHTML = `
    <a href="#" data-page="home">🏠 Home</a>
    <a href="#" data-page="production">🏭 Production</a>
    <a href="#" data-page="maintenance">🔧 Maintenance</a>
  `;

  if (currentUserRole === 'admin') {
    navHTML += `<a href="#" data-page="admin">⚙️ Admin</a>`;
  }

  navHTML += `<a href="#" id="logout-link">🚪 Logout</a>`;
  nav.innerHTML = navHTML;

  // Bind click handlers
  nav.querySelectorAll('a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigate(page);
    });
  });

  // Bind logout
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/login.html';
}


import { scadaStore } from './store.js';

function initWebSocket() {
  if (scadaStore.ws) return;

  // const ws = new WebSocket('ws://localhost:3000');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}`);

  scadaStore.ws = ws;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'plc_update') {
      scadaStore.setData(msg.data); // notify all subscribers
    }
  };

  ws.onopen = () => console.log('WS connected');
  ws.onclose = () => {
    console.log('WS disconnected');
    setTimeout(initWebSocket, 2000); // auto-reconnect
  };
}


// // Main router
export async function navigate(page) {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  if (currentUnmount) currentUnmount();

  const app = document.getElementById('app');

  // 🔥 RESET page classes
  app.className = 'page';

  switch (page) {
    case 'home':
      app.classList.add('page-home');
      app.innerHTML = homeView();
      homeMount?.();
      currentUnmount = homeUnmount;
      break;

    case 'production':
      app.classList.add('page-production');
      app.innerHTML = productionView();
      productionMount?.();
      currentUnmount = productionUnmount;
      break;

    case 'maintenance':
      app.classList.add('page-maintenance');
      app.innerHTML = maintenanceView();
      maintenanceMount?.();
      currentUnmount = maintenanceUnmount;
      break;

    case 'admin':
      if (currentUserRole !== 'admin') {
        alert('Access denied');
        return;
      }
      app.classList.add('page-admin');
      app.innerHTML = adminView();
      adminMount?.();
      currentUnmount = adminUnmount;
      break;

    default:
      navigate('home');
  }
}

// export async function navigate(page) {
//   const isAuthenticated = await checkAuth();
//   if (!isAuthenticated) return;

//   // Cleanup previous
//   if (currentUnmount) currentUnmount();

//   const app = document.getElementById('app');

//   switch (page) {
//     case 'home':
//       app.innerHTML = homeView();
//       homeMount?.();
//       currentUnmount = homeUnmount;
//       break;
//     case 'production':
//       app.innerHTML = productionView();
//       productionMount?.();
//       currentUnmount = productionUnmount;
//       break;
//     case 'maintenance':
//       app.innerHTML = maintenanceView();
//       maintenanceMount?.();
//       currentUnmount = maintenanceUnmount;
//       break;
//     case 'admin':
//       if (currentUserRole !== 'admin') {
//         alert('Access denied');
//         return;
//       }
//       app.innerHTML = adminView();
//       adminMount?.();
//       currentUnmount = adminUnmount;
//       break;
//     default:
//       navigate('home');
//   }
// }

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  // Restore page from URL hash or default to home
  const page = window.location.hash.slice(1) || 'home';
  navigate(page);
});