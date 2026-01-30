// frontend/public/js/app.js
import { renderSidebar } from './sidebar.js';
import { initSidebarBehavior,setActiveSidebar } from './sidebar-behavior.js';
import { routes } from './routes.js';
import { scadaStore } from './store.js';
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
  return true;
}

function mountTopbar() {
  const btn = document.getElementById('logout-btn');
  const roleEl = document.getElementById('user-role');

  if (roleEl) roleEl.textContent = currentUserRole;

  if (btn) {
    btn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      window.location.href = '/login.html';
    });
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { 
    method: 'POST', 
    credentials: 'same-origin' 
  });
  window.location.href = '/login.html';
}

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

function mountSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = renderSidebar(currentUserRole);
  initSidebarBehavior(navigate);

}

function initSidebarToggle() {
  const layout = document.querySelector('.layout');

  // IMPORTANT: button is inside sidebar
  const btn = document.getElementById('toggleSidebar');
  if (!btn || !layout) return;

  btn.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');

    localStorage.setItem(
      'sidebar-collapsed',
      layout.classList.contains('sidebar-collapsed')
    );
  });

  // Restore state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
  }
}

export async function navigate(route) {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  if (currentUnmount) currentUnmount();

  const app = document.getElementById('app');
  app.className = 'page';

  const parts = route.split('.');
  let node = routes;

  for (const part of parts) {
    node = node?.[part];
  }

  if (!node || !node.view) {
    console.warn('Route not found:', route);
    return navigate('home');
  }

  // Role guard
  if (node.role && node.role !== currentUserRole) {
    alert('Access denied');
    return;
  }

  // Page wrapper class
  app.classList.add(`page-${parts[0]}`);

  app.innerHTML = node.view();
  node.mount?.();
  currentUnmount = node.unmount || null;

  // Sync sidebar
  setActiveSidebar(route);
}

async function bootstrap() {
  const ok = await checkAuth();
  if (!ok) return;

  initWebSocket();
  mountTopbar();
  mountSidebar();        // injects sidebar HTML
  initSidebarToggle();   // now button exists
  navigate('home');
}


bootstrap();
