// backend/node/routes/api/alarmHistory.js
const express = require('express');
const router  = express.Router();
const { requireRole } = require('../../middleware/requireRole');

router.get('/', requireRole('admin'), (req, res) => {
  const { from, to, code, limit } = req.query;

  const logs = global.services.logService.getRecent({
    type:  'ALARM',
    from:  from  || null,
    to:    to    || null,
    limit: Number(limit) || 200,   // raised from 10 → 200
  });

  // Optional code filter (client can filter by alarm code)
  const result = code
    ? logs.filter(l => l.code === code)
    : logs;

  res.json(result);
});

module.exports = router;
