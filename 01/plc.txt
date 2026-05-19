// backend/node/routes/api/plc.js
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/requireRole');

router.get('/status', (req, res) => {
  const status = global.services.pythonBridge.getStatus();
  res.json(status);
});

router.post('/start',requireRole('admin'), (req, res) => {
  const ok = global.services.pythonBridge.start();

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'START_PLC',
    message: 'PLC start requested'
  });

  res.json({ ok });
});

router.post('/stop', requireRole('admin'), (req, res) => {
  const ok = global.services.pythonBridge.stop();

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'STOP_PLC',
    message: 'PLC stop requested'
  });

  res.json({ ok });
});
router.post('/write', requireRole('admin'), (req, res) => {
  const { tag, value } = req.body;
  const ok = global.services.pythonBridge.writeTag(tag, value);

  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'WRITE_PLC_TAG',
    message: 'PLC tag write requested'
  });

  res.json({ ok });
});

module.exports = router;