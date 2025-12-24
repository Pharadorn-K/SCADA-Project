// backend/node/routes/websocket.js
module.exports = (wss, plcMonitor) => {
  wss.on('connection', (ws) => {
    console.log('🟢 New WebSocket client connected');

    // Optional: send current state on connect
    const latestData = plcMonitor.getLatestData();
    if (latestData) {
      ws.send(JSON.stringify({ type: 'plc_update', data: latestData }));
    }

    ws.on('close', () => {
      console.log('🔴 WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // Attach wss to plcMonitor so it can broadcast
  plcMonitor.setWss(wss);
};