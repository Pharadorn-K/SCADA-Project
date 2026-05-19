// backend/node/services/plcMonitor.js
const WebSocket = require('ws');

let wss = null;

function setWss(server) {
  wss = server;

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'plc_snapshot',
      payload: global.services.stateStore.getPlcSnapshot()
    }));
  });
}

function broadcast(type, payload) {
  if (!wss) return;

  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

module.exports = { setWss, broadcast };
