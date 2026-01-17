// backend/node/routes/api/alarm.js

// module.exports = router;
const express = require('express');
const router = express.Router();
// const { requireRole } = require('../../middleware/requireRole');, requireRole('admin'), requireRole('admin')

router.get('/', (req, res) => {
  res.json(global.services.alarmService.getAll());
});

router.post('/ack/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = req.session.userId;

  const ok = global.services.alarmService.acknowledge(id, user);
  res.json({ ok });
});

module.exports = router;
