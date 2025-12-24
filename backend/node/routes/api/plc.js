// backend/node/routes/api/plc.js
const express = require('express');
const router = express.Router();

router.post('/start', (req, res) => {
  const { success } = global.services.pythonBridge.start();
  res.json({ success, message: success ? 'PLC polling started' : 'Already running' });
});

router.post('/stop', (req, res) => {
  const { success } = global.services.pythonBridge.stop();
  res.json({ success, message: success ? 'PLC polling stopped' : 'Not running' });
});

router.post('/write', (req, res) => {
  const { tag, value } = req.body;
  if (!tag || value === undefined) {
    return res.status(400).json({ error: 'Missing tag or value' });
  }
  const success = global.services.pythonBridge.writeTag(tag, value);
  res.json({ success, tag, value });
});

module.exports = router;