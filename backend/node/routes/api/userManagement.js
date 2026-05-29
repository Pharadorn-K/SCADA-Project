// backend/node/routes/api/userManagement.js
//
// Invite-token flow:
//   Admin calls POST /api/auth/invites  → gets a one-time token (valid 24h)
//   New user pastes that token on the sign-up page
//   POST /api/auth/signup validates the token and creates the account
//
const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const { getDbPool }   = require('../../services/db');
const { requireRole } = require('../../middleware/requireRole');

// In-memory token store  { token → { role, expiresAt, usedAt } }
// For production you could move this to the DB, but in-memory is fine for
// the single-server deployment this project runs on.
const inviteTokens = new Map();

// Prune expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [t, v] of inviteTokens) {
    if (v.expiresAt < now) inviteTokens.delete(t);
  }
}, 3600 * 1000);

// ── POST /api/auth/invites  (admin only) ──────────────────────────────────────
// Body: { role: 'operator'|'supervisor' }   (admin cannot invite another admin)
router.post('/invites', requireRole('admin'), (req, res) => {
  const { role = 'operator' } = req.body;
  if (!['operator', 'supervisor'].includes(role)) {
    return res.status(400).json({ success: false, message: 'role must be operator or supervisor' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  inviteTokens.set(token, {
    role,
    createdBy: req.session.userId,
    expiresAt: Date.now() + 24 * 3600 * 1000,
    usedAt: null,
  });

  global.services?.logService?.log({
    type: 'AUDIT', severity: 'INFO',
    user: req.session.userId, role: req.session.role,
    action: 'CREATE_INVITE', message: `Invite token created for role ${role}`
  });

  res.json({ success: true, token, expiresIn: '24h', role });
});

// ── GET /api/auth/invites  (admin only) ───────────────────────────────────────
router.get('/invites', requireRole('admin'), (req, res) => {
  const now    = Date.now();
  const tokens = [...inviteTokens.entries()].map(([t, v]) => ({
    token:     t.slice(0, 8) + '…',   // show only prefix for security
    role:      v.role,
    createdBy: v.createdBy,
    expiresAt: new Date(v.expiresAt).toISOString(),
    expired:   v.expiresAt < now,
    used:      !!v.usedAt,
  }));
  res.json({ success: true, tokens });
});

// ── POST /api/auth/signup  (public — validated by invite token) ───────────────
router.post('/signup', async (req, res) => {
  try {
    const { token, username, display_name, password } = req.body;

    if (!token || !username || !password) {
      return res.status(400).json({ success: false, message: 'token, username, and password are required' });
    }

    // Validate token
    const invite = inviteTokens.get(token);
    if (!invite) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invite token' });
    }
    if (invite.expiresAt < Date.now()) {
      inviteTokens.delete(token);
      return res.status(400).json({ success: false, message: 'Invite token has expired' });
    }
    if (invite.usedAt) {
      return res.status(400).json({ success: false, message: 'Invite token has already been used' });
    }

    // Validate inputs
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Username: 3–32 chars, letters/digits/._- only' });
    }

    const pool = await getDbPool();
    const [existing] = await pool.query(
      'SELECT id FROM scada_users WHERE username = ? LIMIT 1', [username]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      `INSERT INTO scada_users (username, display_name, password_hash, role, active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 0)`,
      [username, display_name ?? username, hash, invite.role]
    );

    // Mark token as used (not deleted — keep for audit trail until it expires)
    invite.usedAt = new Date().toISOString();

    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: username, role: invite.role,
      action: 'SIGNUP', message: `Self-registered via invite from ${invite.createdBy}`
    });

    res.json({ success: true, role: invite.role });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;