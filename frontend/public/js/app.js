// frontend/public/js/app.js
import { renderSidebar } from './sidebar.js';
import { initSidebarBehavior,setActiveSidebar } from './sidebar-behavior.js';
import { routes } from './routes.js';
import { scadaStore } from './store.js';

let currentUnmount = null;
let currentUserRole = null;
window.scadaStore = scadaStore; // 👈 debug only

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
let localTimer = null;

function startLocalTicker() {

  if (localTimer) return; // prevent multiple timers

  localTimer = setInterval(() => {

    Object.values(scadaStore.state.machines).forEach(machine => {

      if (!machine.status) return;

      const bucketMap = {
        RUNNING: 'run_seconds',
        IDLE: 'idle_seconds',
        ALARM: 'alarm_seconds',
        OFFLINE: 'offline_seconds'
      };

      const bucket = bucketMap[machine.status];
      if (!bucket) return;

      machine.shiftDurations[bucket] += 1;

    });

    scadaStore.notify();

  }, 1000);
}

function initWebSocket() {
  if (scadaStore.ws) return;

  // const ws = new WebSocket('ws://localhost:3000');
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}`);

  scadaStore.ws = ws;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);


    if (msg.type === 'plc_snapshot') {
      clearInterval(localTimer);
      localTimer = null;      
      scadaStore.setSnapshot(msg.payload);
      startLocalTicker();
    }


    if (msg.type === 'plc_update') {
      scadaStore.applyUpdate(msg.payload);
    }

    if (msg.type === 'plc_clean') {
      scadaStore.applyPlcClean(msg.payload);
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
  const icon = document.getElementById('toggleIcon');
  if (!btn || !layout) return;

  const updateIcon = () => {
    if (layout.classList.contains('sidebar-collapsed')) {
      icon.classList.remove('fa-angles-left');
      icon.classList.add('fa-angles-right');
    } else {
      icon.classList.remove('fa-angles-right');
      icon.classList.add('fa-angles-left');
    }
  };

  btn.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');
    updateIcon();

    localStorage.setItem(
      'sidebar-collapsed',
      layout.classList.contains('sidebar-collapsed')
    );
  });

  // Restore state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
  }
  
  // Set initial icon
  updateIcon();
}

function startClock() {
  const clockEl = document.getElementById('digital-clock');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();

    const date = now.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const time = now.toLocaleTimeString();

    clockEl.textContent = `${date} | ${time}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
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

  if (!node) {
    console.warn('Route not found:', route);
    return;
  }

  // Role guard
  if (node.role && node.role !== currentUserRole) {
    alert('Access denied');
    return;
  }

  // Page wrapper class
  app.classList.add(`page-${parts[0]}`);

  // Clear page
  app.innerHTML = '';

  // Render static HTML if provided
  if (node.view) {
    app.innerHTML = node.view();
  }

  // Mount dynamic logic (WS, subscriptions, DOM updates)
  node.mount?.(app);

  currentUnmount = node.unmount || null;

  // Sync sidebar
  setActiveSidebar(route);
}


function handleHashNavigation() {
  const hash = window.location.hash.slice(1); // drop '#'
  if (!hash) return;

  const [path] = hash.split('?');
  const route = path.replace(/\//g, '.');
  if (route) navigate(route);
}

async function bootstrap() {
  const ok = await checkAuth();
  if (!ok) return;

  initWebSocket();
  mountTopbar();
  mountSidebar();        // injects sidebar HTML
  initSidebarToggle();   // now button exists

  // if user landed with a hash, navigate there; otherwise go home
  if (window.location.hash) {
    handleHashNavigation();
  } else {
    navigate('home');
  }

  startClock();
}

// respond when something else (like a card click) updates the hash
window.addEventListener('hashchange', handleHashNavigation);

bootstrap();
