// backend/node/services/plcMonitor.js
let latestData = {};
let wss = null;

function updateData(data) {
  latestData = data;
  if (wss) {
    const payload = JSON.stringify({ type: 'plc_update', data });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

function getLatestData() {
  return latestData;
}

function setWss(webSocketServer) {
  wss = webSocketServer;
}

module.exports = { updateData, getLatestData, setWss };