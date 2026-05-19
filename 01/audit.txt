// backend/node/routes/api/audit.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const LOG_FILE = path.join(__dirname, '../../logs/scada.log');

/* 🔐 Admin guard */
function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

/* GET /api/audit */
router.get('/', requireAdmin, (req, res) => {
  const {
    limit = 100,
    action,
    user,
    from,
    to
  } = req.query;

  if (!fs.existsSync(LOG_FILE)) {
    return res.json([]);
  }

  const lines = fs
    .readFileSync(LOG_FILE, 'utf-8')
    .trim()
    .split('\n')
    .reverse(); // newest first

  const results = [];

  for (const line of lines) {
    if (results.length >= limit) break;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'AUDIT') continue;
    if (action && entry.action !== action) continue;
    if (user && entry.user !== user) continue;

    const ts = new Date(entry.ts).getTime();
    if (from && ts < new Date(from).getTime()) continue;
    if (to && ts > new Date(to).getTime()) continue;

    results.push(entry);
  }

  res.json(results);
});

module.exports = router;
