// backend/node/routes/api/alarm.js
const express = require('express');
const router = express.Router();

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
