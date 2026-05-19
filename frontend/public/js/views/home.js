// frontend/public/js/views/home.js
import { scadaStore } from '../store.js';
let unsubscribe = null;

// ── Machine registry ─────────────────────────────────────────────────────
const MACHINE_REGISTRY = {
  'press_AIDA630T':   { label: 'AIDA 630T' },
  'press_M-20id-25':  { label: 'M-20iD/25' },
  'heat_DKK1':        { label: 'DKK1' },
  'heat_DKK2':        { label: 'DKK2' },
  'heat_K3':          { label: 'K3' },
  'heat_K4':          { label: 'K4' },
  'heat_K5':          { label: 'K5' },
  'heat_K6':          { label: 'K6' },
  'heat_K7':          { label: 'K7' },
  'heat_K8':          { label: 'K8' },
  'lathe_Rotor TK1':  { label: 'Rotor TK1' },
  'lathe_Rotor TK4':  { label: 'Rotor TK4' },
};

// Dept accent colours — must match SVG zone fills
const DEPT_META = {
  Press: { color: '#378ADD', bg: '#EAF2FB', icon: '🛞' },
  Heat:  { color: '#E67E22', bg: '#FDF0E3', icon: '🔥' },
  Lathe: { color: '#9B59B6', bg: '#F5EEF8', icon: '⚡' },
};

export function homeView() {
  return `
  <div class="home-grid">
    <div class="plant-container">
      <svg viewBox="10 0 1100 690" id="plant-layout">
        <defs>
          <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="#c8d0da" stroke-width="0.5"/>
          </pattern>
          <pattern id="wallpattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="12" height="12" fill="#4c4c4c"/>
            <line x1="0" y1="6" x2="12" y2="6" stroke="#212121" stroke-width="4"/>
          </pattern>
          <pattern id="wallemptypattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="#777f84"/>
            <line x1="0" y1="6" x2="12" y2="6" stroke="#94999b" stroke-width="4"/>
          </pattern>
          <pattern id="reservedpattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="#fcbebe"/>
            <line x1="0" y1="6" x2="12" y2="6" stroke="#f0c0c0" stroke-width="4"/>
          </pattern>
          <pattern id="resevedplantpattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="#cbe6f7"/>
            <line x1="0" y1="6" x2="12" y2="6" stroke="#92d5f0" stroke-width="4"/>
          </pattern>
        </defs>

        <g id="viewport">
          <!-- STREET -->
          <polygon points="-550,0 -550,725 1630,725 1630,-45 755,-45 755,-500 710,-500 710,-45 -550,-45 -550,0 -45,0 -45,690 0,690 0,0 1130,0 1130,690 1175,690 1175,0 1595,0 1595,690 -505,690 -505,0" fill="#4c4c4c" stroke="#c49600" stroke-width="1"/>
          <!-- PLANT FLOOR -->
          <rect x="1045" y="5" width="80" height="130" fill="url(#wallemptypattern)" stroke="#444" stroke-width="1" rx="4"/>
          <rect x="1045" y="605" width="80" height="70" fill="url(#wallemptypattern)" stroke="#444" stroke-width="1" rx="4"/>
          <polygon points=" 5,5 5,675 1040,675 1040,600 1125,600 1125,140 1040,140 1040,5 10,5 10,10 1035,10 1035,145 1120,145 1120,595 1035,595 1035,670 10,670 10,5 " fill="url(#wallpattern)" stroke="#444" stroke-width="1" class="plant-db"/>
          <rect x="5" y="-500" width="700" height="450" fill="url(#resevedplantpattern)" stroke="#1d7fc5" stroke-width="1" rx="4"/>
          <text x="350" y="-250" text-anchor="middle" class="zone-label" fill="#1d7fc5">WAREHOUSE</text>
          <rect x="1180" y="5" width="410" height="675" fill="url(#resevedplantpattern)" stroke="#1d7fc5" stroke-width="1" rx="4"/>
          <text x="1380" y="350" text-anchor="middle" class="zone-label" fill="#1d7fc5">NEW PLANT</text>
          <rect x="-500" y="5" width="450" height="675" fill="url(#resevedplantpattern)" stroke="#1d7fc5" stroke-width="1" rx="4"/>
          <text x="-270" y="350" text-anchor="middle" class="zone-label" fill="#1d7fc5">FINE BLANKING</text>
          <!-- WALKWAYS -->
          <rect x="215"  y="11"  width="25"   height="658" fill="#015304" stroke="#ffffff" stroke-width="1"/>
          <rect x="780"  y="11"  width="25"   height="658" fill="#015304" stroke="#ffffff" stroke-width="1"/>
          <rect x="595"  y="145"  width="15"   height="417" fill="#015304" stroke="#ffffff" stroke-width="1"/>
          <rect x="410"  y="145"  width="15"   height="417" fill="#015304" stroke="#ffffff" stroke-width="1"/>
          <rect x="12"   y="116" width="1021" height="30" fill="#015304" stroke="#ffffff" stroke-width="1"/>
          <rect x="240"   y="562" width="540" height="20" fill="#015304" stroke="#ffffff" stroke-width="1"/>
          <!-- ZONES -->
          <rect x="808" y="14" width="223" height="98" fill="#378ADD" opacity="0.12" stroke="#378ADD" stroke-width="1.5" />
          <rect x="430" y="14" width="348" height="98" fill="#378ADD" opacity="0.12" stroke="#378ADD" stroke-width="1.5" />
          <text x="455" y="25" text-anchor="middle" class="zone-label" fill="#185FA5">PRESS</text>
          <rect x="810" y="150" width="305" height="230" fill="#E67E22" opacity="0.12" stroke="#E67E22" stroke-width="1.5" />
          <text x="835" y="165" text-anchor="middle" class="zone-label" fill="#854F0B">HEAT</text>
          <rect x="615" y="150" width="160" height="380" fill="#9B59B6" opacity="0.10" stroke="#9B59B6" stroke-width="1.5" />
          <rect x="430" y="150" width="160" height="380" fill="#9B59B6" opacity="0.10" stroke="#9B59B6" stroke-width="1.5" />
          <text x="455" y="165" text-anchor="middle" class="zone-label" fill="#6C3483">LATHE</text>
          <rect x="15" y="280" width="195" height="385" fill="#E74C3C" opacity="0.10" stroke="#E74C3C" stroke-width="1.5" />
          <text x="40" y="295" text-anchor="middle" class="zone-label" fill="#922B21">GRIND</text>
          <polygon points=" 810,385 810,665 1030,665 1030,589 1115,589 1115,385" fill="#e9dfbb" stroke-width="1.5" />
          <text x="835" y="400" text-anchor="middle" class="zone-label" fill="#9A7D0A">PAINT</text>
          <rect x="245" y="150" width="160" height="380" fill="#afe6b3" opacity="0.10" stroke="#1da648" stroke-width="1.5" />
          <text x="290" y="165" text-anchor="middle" class="zone-label" fill="#02621f">SPROCKETS</text>
          <rect x="285" y="585" width="493" height="80" fill="#D6EAF8" opacity="0.6" stroke="#AED6F1" stroke-width="1.5" />
          <text x="525" y="630" text-anchor="middle" class="zone-label" fill="#1A5276">OFFICE</text>
          <rect x="245" y="535" width="160" height="25" fill="#FDEBD0" stroke="#F0A500" stroke-width="1" rx="3"/>
          <text x="325" y="553" text-anchor="middle" class="wip-label">WIP</text>
          <rect x="430" y="535" width="160" height="25" fill="#FDEBD0" stroke="#F0A500" stroke-width="1" rx="3"/>
          <text x="510" y="553" text-anchor="middle" class="wip-label">WIP</text>
          <rect x="615" y="535" width="160" height="25" fill="#FDEBD0" stroke="#F0A500" stroke-width="1" rx="3"/>
          <text x="695" y="553" text-anchor="middle" class="wip-label">WIP</text>
          <rect x="245" y="585" width="35" height="80" fill="#FDEBD0" stroke="#F0A500" stroke-width="1" rx="3"/>
          <text x="263" y="630" text-anchor="middle" class="wip-label">WIP</text>

          <!-- PRESS MACHINES -->
          <g id="press_M-20id-25_group" class="machine-group" onclick="handleMachineClick('press_M-20id-25')">
            <rect id="press_M-20id-25" x="830" y="20" width="70" height="40" class="machine" rx="4"/>
            <text x="865" y="40" text-anchor="middle" class="mc-label">M-20iD/25</text>
            <text id="txt_press_M-20id-25" x="865" y="50" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="press_AIDA630T_group" class="machine-group" onclick="handleMachineClick('press_AIDA630T')">
            <rect id="press_AIDA630T" x="905" y="20" width="70" height="40" class="machine" rx="4"/>
            <text x="940" y="40" text-anchor="middle" class="mc-label">AIDA 630T</text>
            <text id="txt_press_AIDA630T" x="940" y="50" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <rect x="810" y="70" width="70" height="40" class="machine unknown" rx="4"/>
          <text x="845" y="100" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="885" y="70" width="70" height="40" class="machine unknown" rx="4"/>
          <text x="920" y="100" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="960" y="70" width="70" height="40" class="machine unknown" rx="4"/>
          <text x="995" y="100" text-anchor="middle" class="mc-label" fill="#aaa">--</text>

          <!-- HEAT MACHINES -->
          <g id="heat_K3_group" class="machine-group" onclick="handleMachineClick('heat_K3')">
            <rect id="heat_K3" x="955" y="270" width="70" height="40" class="machine" rx="4"/>
            <text x="990" y="290" text-anchor="middle" class="mc-label">K3</text>
            <text id="txt_heat_K3" x="990" y="300" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_K4_group" class="machine-group" onclick="handleMachineClick('heat_K4')">
            <rect id="heat_K4" x="955" y="315" width="70" height="40" class="machine" rx="4"/>
            <text x="990" y="335" text-anchor="middle" class="mc-label">K4</text>
            <text id="txt_heat_K4" x="990" y="345" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_K5_group" class="machine-group" onclick="handleMachineClick('heat_K5')">
            <rect id="heat_K5" x="830" y="270" width="70" height="40" class="machine" rx="4"/>
            <text x="865" y="290" text-anchor="middle" class="mc-label">K5</text>
            <text id="txt_heat_K5" x="865" y="300" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_K6_group" class="machine-group" onclick="handleMachineClick('heat_K6')">
            <rect id="heat_K6" x="830" y="315" width="70" height="40" class="machine" rx="4"/>
            <text x="865" y="335" text-anchor="middle" class="mc-label">K6</text>
            <text id="txt_heat_K6" x="865" y="345" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_K7_group" class="machine-group" onclick="handleMachineClick('heat_K7')">
            <rect id="heat_K7" x="830" y="170" width="70" height="40" class="machine" rx="4"/>
            <text x="865" y="190" text-anchor="middle" class="mc-label">K7</text>
            <text id="txt_heat_K7" x="865" y="200" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_K8_group" class="machine-group" onclick="handleMachineClick('heat_K8')">
            <rect id="heat_K8" x="830" y="215" width="70" height="40" class="machine" rx="4"/>
            <text x="865" y="235" text-anchor="middle" class="mc-label">K8</text>
            <text id="txt_heat_K8" x="865" y="245" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_DKK1_group" class="machine-group" onclick="handleMachineClick('heat_DKK1')">
            <rect id="heat_DKK1" x="955" y="170" width="70" height="40" class="machine" rx="4"/>
            <text x="990" y="190" text-anchor="middle" class="mc-label">DKK1</text>
            <text id="txt_heat_DKK1" x="990" y="200" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="heat_DKK2_group" class="machine-group" onclick="handleMachineClick('heat_DKK2')">
            <rect id="heat_DKK2" x="955" y="215" width="70" height="40" class="machine" rx="4"/>
            <text x="990" y="235" text-anchor="middle" class="mc-label">DKK2</text>
            <text id="txt_heat_DKK2" x="990" y="245" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <rect x="1040" y="170" width="70" height="40" class="machine unknown" rx="4"/>
          <text x="1075" y="200" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="1040" y="215" width="70" height="40" class="machine unknown" rx="4"/>
          <text x="1075" y="245" text-anchor="middle" class="mc-label" fill="#aaa">--</text>

          <!-- LATHE MACHINES -->
          <g id="lathe_Rotor TK1_group" class="machine-group" onclick="handleMachineClick('lathe_Rotor TK1')">
            <rect id="lathe_Rotor TK1" x="700" y="390" width="70" height="40" class="machine" rx="4"/>
            <text x="735" y="410" text-anchor="middle" class="mc-label">Rotor TK1</text>
            <text id="txt_lathe_Rotor TK1" x="735" y="420" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <g id="lathe_Rotor TK4_group" class="machine-group" onclick="handleMachineClick('lathe_Rotor TK4')">
            <rect id="lathe_Rotor TK4" x="700" y="345" width="70" height="40" class="machine" rx="4"/>
            <text x="735" y="365" text-anchor="middle" class="mc-label">Rotor TK4</text>
            <text id="txt_lathe_Rotor TK4" x="735" y="375" text-anchor="middle" class="mc-sub">--</text>
          </g>
          <!-- Unregistered lathe -->
          <rect x="620" y="155" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="185" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="200" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="225" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="250" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="280" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="295" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="325" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="345" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="375" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="390" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="420" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="440" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="475" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="620" y="485" width="70" height="40" class="machine unknown" rx="4"/><text x="655" y="520" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="700" y="155" width="70" height="40" class="machine unknown" rx="4"/><text x="735" y="185" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="700" y="200" width="70" height="40" class="machine unknown" rx="4"/><text x="735" y="225" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="700" y="250" width="70" height="40" class="machine unknown" rx="4"/><text x="735" y="280" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="700" y="295" width="70" height="40" class="machine unknown" rx="4"/><text x="735" y="325" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="700" y="440" width="70" height="40" class="machine unknown" rx="4"/><text x="735" y="475" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="700" y="485" width="70" height="40" class="machine unknown" rx="4"/><text x="735" y="520" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <!-- Grinding -->
          <rect x="30" y="300" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="330" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="345" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="375" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="390" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="420" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="435" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="465" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="480" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="510" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="525" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="555" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="570" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="600" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="30" y="615" width="70" height="40" class="machine unknown" rx="4"/><text x="65" y="645" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="345" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="375" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="390" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="420" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="435" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="465" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="480" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="510" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="525" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="555" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="570" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="600" text-anchor="middle" class="mc-label" fill="#aaa">--</text>
          <rect x="120" y="615" width="70" height="40" class="machine unknown" rx="4"/><text x="155" y="645" text-anchor="middle" class="mc-label" fill="#aaa">--</text>

          <!-- LEGEND -->
          <rect x="5" y="678" width="10" height="10" fill="#1D9E75" rx="2"/>
          <text x="20" y="686" class="legend-label">Run</text>
          <rect x="45" y="678" width="10" height="10" fill="#BA7517" rx="2"/>
          <text x="60" y="686" class="legend-label">Idle</text>
          <rect x="83" y="678" width="10" height="10" fill="#A32D2D" rx="2"/>
          <text x="98" y="686" class="legend-label">Alarm</text>
          <rect x="128" y="678" width="10" height="10" fill="#555" rx="2"/>
          <text x="143" y="686" class="legend-label">Offline</text>
          <rect x="178" y="678" width="10" height="10" fill="#ccc" stroke="#888" stroke-width="1" stroke-dasharray="3 2" rx="2"/>
          <text x="193" y="686" class="legend-label">Unknown</text>
          <text x="1125" y="685" text-anchor="end" class="legend-label" fill="#aaa">scroll to zoom · drag to pan · dbl-click to reset</text>
        </g>
      </svg>
    </div>

    <!-- RIGHT PANEL -->
    <div class="home-right-panel">
      <div class="detail-plant-container">
        <h3>Overview</h3>
        <div id="home-overview-stats"></div>
      </div>
      <div class="detail-plant-container">
        <h3>Active alarms</h3>
        <div id="home-alarm-list" class="home-alarm-list"></div>
      </div>
      <div class="detail-plant-container">
        <h3>Production count</h3>
        <div id="home-production-count"></div>
      </div>
    </div>
  </div>

  <!-- Tooltip -->
  <div id="mc-tooltip" class="mc-tooltip" style="display:none"></div>
  `;
}

export function homeMount() {

  // ── machine click handler ────────────────────────────────────────────────
  window.handleMachineClick = (id) => {
    const [dept, machine] = id.split('_');
    window.location.hash =
      `#production/machine_efficiency?dept=${dept}&machine=${machine}`;
  };

  // ── tooltip ──────────────────────────────────────────────────────────────
  const tooltip = document.getElementById('mc-tooltip');

  function showTooltip(e, id, m) {
    const status = m.status ?? '--';
    const part   = m.context?.part_name  ?? '--';
    const cycle  = m.tags?.cycle_time    ?? '--';
    const count  = m.tags?.count_shift   ?? '--';
    const plan   = m.context?.plan       ?? '--';
    tooltip.innerHTML = `
      <div class="tt-name">${MACHINE_REGISTRY[id]?.label ?? id}</div>
      <div class="tt-row"><span>Status</span><span class="tt-val tt-${status.toLowerCase()}">${status}</span></div>
      <div class="tt-row"><span>Part</span><span class="tt-val">${part}</span></div>
      <div class="tt-row"><span>Cycle</span><span class="tt-val">${cycle} s</span></div>
      <div class="tt-row"><span>Count shift</span><span class="tt-val">${count} / ${plan}</span></div>
    `;
    tooltip.style.display = 'block';
    moveTooltip(e);
  }

  function moveTooltip(e) {
    tooltip.style.left = `${e.clientX + 14}px`;
    tooltip.style.top  = `${e.clientY - 10}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  // ── store subscription ───────────────────────────────────────────────────
  unsubscribe = scadaStore.subscribe((state) => {

    // ── machine rects ───────────────────────────────────────────────────
    Object.entries(state.machines).forEach(([id, m]) => {
      const rect = document.getElementById(id);
      const txt  = document.getElementById(`txt_${id}`);
      if (!rect) return;

      const status = m.status?.toLowerCase() || 'offline';
      rect.className.baseVal = `machine ${status}`;

      if (txt) txt.textContent = m.context?.part_name ?? '--';

      const group = rect.closest('.machine-group');
      if (group && !group.dataset.tipBound) {
        group.dataset.tipBound = '1';
        group.addEventListener('mouseenter', e => showTooltip(e, id, m));
        group.addEventListener('mousemove',  moveTooltip);
        group.addEventListener('mouseleave', hideTooltip);
      } else if (group) {
        group.onmouseenter = e => showTooltip(e, id, scadaStore.state.machines[id]);
      }
    });

    // ── overview stats ──────────────────────────────────────────────────
    const statsEl = document.getElementById('home-overview-stats');
    if (statsEl) {
      const machines = Object.values(state.machines);
      const total    = machines.length;
      const running  = machines.filter(m => m.status === 'RUNNING').length;
      const idle     = machines.filter(m => m.status === 'IDLE').length;
      const alarm    = machines.filter(m => m.status === 'ALARM').length;
      const offline  = machines.filter(m => m.status === 'OFFLINE').length;

      statsEl.innerHTML = `
        <div class="home-stat-grid">
          <div class="home-stat running"><div class="hs-num">${running}</div><div class="hs-lbl">Running</div></div>
          <div class="home-stat idle"><div class="hs-num">${idle}</div><div class="hs-lbl">Idle</div></div>
          <div class="home-stat alarm"><div class="hs-num">${alarm}</div><div class="hs-lbl">Alarm</div></div>
          <div class="home-stat offline"><div class="hs-num">${offline}</div><div class="hs-lbl">Offline</div></div>
        </div>
        <div class="home-total">${total} machines monitored</div>
      `;
    }

    // ── alarm list ──────────────────────────────────────────────────────
    const alarmEl = document.getElementById('home-alarm-list');
    if (alarmEl) {
      const alarmed = Object.entries(state.machines)
        .filter(([, m]) => m.status === 'ALARM');

      if (!alarmed.length) {
        alarmEl.innerHTML = '<div class="home-no-alarm">No active alarms</div>';
      } else {
        alarmEl.innerHTML = alarmed.map(([id, m]) => `
          <div class="home-alarm-row" onclick="handleMachineClick('${id}')">
            <span class="ha-dot"></span>
            <span class="ha-name">${MACHINE_REGISTRY[id]?.label ?? id}</span>
            <span class="ha-code">#${m.tags?.alarm_code ?? '?'}</span>
          </div>
        `).join('');
      }
    }

    // ── production count (redesigned) ───────────────────────────────────
    const productionEl = document.getElementById('home-production-count');
    if (productionEl) {
      const machines = Object.values(state.machines);

      // Group by department, preserving display order
      const DEPT_ORDER = ['Press', 'Heat', 'Lathe'];
      const byDept = {};
      machines.forEach(m => {
        const dept = m.department || 'Unknown';
        if (!byDept[dept]) byDept[dept] = [];
        byDept[dept].push(m);
      });

      // Sort depts by preferred order, unknowns at end
      const deptKeys = [
        ...DEPT_ORDER.filter(d => byDept[d]),
        ...Object.keys(byDept).filter(d => !DEPT_ORDER.includes(d))
      ];

      productionEl.innerHTML = deptKeys.map(dept => {
        const list   = byDept[dept];
        const meta   = DEPT_META[dept] ?? { color: '#888', bg: '#f4f6f8', icon: '◈' };
        const active = list.filter(m => m.status === 'RUNNING').length;

        const rows = list.map(m => {
          const id      = `${(m.department || '').toLowerCase()}_${m.machine}`;
          const label   = MACHINE_REGISTRY[id]?.label ?? m.machine;
          const part    = m.context?.part_name ?? '—';
          const count   = Number(m.tags?.count_shift ?? 0);
          const plan    = Number(m.context?.plan ?? 0);
          const pct     = plan > 0 ? Math.min(100, Math.round(count / plan * 100)) : 0;
          const st      = (m.status || 'offline').toLowerCase();

          const barColor = { running:'#1D9E75', idle:'#BA7517', alarm:'#A32D2D', offline:'#c5c9d0' }[st] ?? '#c5c9d0';

          return `
            <div class="pc-row" onclick="handleMachineClick('${id}')">
              <div class="pc-row-left">
                <span class="pc-dot pc-dot-${st}"></span>
                <span class="pc-machine">${label}</span>
              </div>
              <div class="pc-row-right">
                <span class="pc-part">${part}</span>
                <div class="pc-bar-wrap">
                  <div class="pc-bar-fill" style="width:${pct}%;background:${barColor}"></div>
                </div>
                <span class="pc-count">${count}<span class="pc-plan">/${plan > 0 ? plan : '—'}</span></span>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="pc-dept">
            <div class="pc-dept-head" style="--dept-color:${meta.color};--dept-bg:${meta.bg}">
              <span class="pc-dept-icon">${meta.icon}</span>
              <span class="pc-dept-name">${dept}</span>
              <span class="pc-dept-active">${active} running</span>
            </div>
            <div class="pc-dept-body">${rows}</div>
          </div>
        `;
      }).join('');
    }

  }); // end subscribe

  // ── pan / zoom ───────────────────────────────────────────────────────────
  const svg      = document.getElementById('plant-layout');
  const viewport = document.getElementById('viewport');
  let scale = 1, panX = 0, panY = 0;
  let isPanning = false, startX = 0, startY = 0;

  function applyTransform() {
    viewport.setAttribute('transform',
      `translate(${panX},${panY}) scale(${scale})`);
  }

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect   = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX   = (mouseX - panX) / scale;
    const svgY   = (mouseY - panY) / scale;
    scale = Math.min(Math.max(0.3, scale - e.deltaY * 0.001), 4);
    panX  = mouseX - svgX * scale;
    panY  = mouseY - svgY * scale;
    applyTransform();
  }, { passive: false });

  svg.addEventListener('mousedown', e => {
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    svg.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
    svg.style.cursor = 'grab';
  });

  svg.addEventListener('dblclick', () => {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  });

  svg.style.cursor = 'grab';
}

export function homeUnmount() {
  if (unsubscribe) unsubscribe();
  delete window.handleMachineClick;
  const tt = document.getElementById('mc-tooltip');
  if (tt) tt.remove();
}