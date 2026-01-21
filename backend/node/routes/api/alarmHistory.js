// backend/node/routes/api/alarmHistory.js
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/requireRole');

router.get('/', requireRole('admin'), (req, res) => {
  const { from, to, limit } = req.query;

  const logs = global.services.logService.getRecent({
    type: 'ALARM',
    from,
    to,
    limit: Number(limit) || 10
  });

  res.json(logs);
});


module.exports = router;
