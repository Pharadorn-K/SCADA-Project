const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/requireRole');

router.get('/', requireRole(['admin']), (req, res) => {
  const logs = global.services.logService.getRecent({
    type: 'ALARM',
    limit: 100
  });

  res.json(logs);
});

module.exports = router;
