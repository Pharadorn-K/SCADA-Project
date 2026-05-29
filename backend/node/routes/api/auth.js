// // backend/node/routes/api/auth.js
// const express = require('express');
// const bcrypt = require('bcryptjs');
// const router = express.Router();

// // Hardcoded user for demo (replace with DB in real app)
// const VALID_USERS = [
//   { 
//     username: 'admin', 
//     passwordHash: '$2b$10$dcsYRXvpYuRZ2nJ1Z0.R6.IYGum/iFKQol/.x6yGY8LoX23SF5Li2', //'scada123'
//     role: 'admin' 
//   },
//   {
//     username: 'operator',
//     passwordHash: '$2b$10$KtV1W2Djxtgv8ap3IAxMPeP7vWgt.uQyhxY7HyC30i0vfcV05k.cK', //'user2026'
//     role: 'operator'
//   }
// ];

// router.post('/login', (req, res) => {
//   const { username, password } = req.body;
//   const user = VALID_USERS.find(u => u.username === username);

//   if (user && bcrypt.compareSync(password, user.passwordHash)) {
//     req.session.userId = username;
//     req.session.role   = user.role;

//     // register session
//     global.services?.sessionRegistry?.register(
//       req.sessionID, username, user.role
//     );

//     global.services.logService.log({
//       type: 'AUDIT', severity: 'INFO',
//       user: username, role: user.role,
//       action: 'LOGIN', message: 'User logged in'
//     });
//     return res.json({ success: true });
//   }
//   res.status(401).json({ success: false, message: 'Invalid credentials' });
// });

// router.post('/logout', (req, res) => {
//   const userId    = req.session?.userId   || 'unknown';
//   const role      = req.session?.role     || 'unknown';
//   const sessionId = req.sessionID;

//   req.session.destroy(err => {
//     if (err) {
//       console.error('Session destroy error:', err);
//       return res.status(500).json({ success: false });
//     }

//     global.services?.sessionRegistry?.remove(sessionId);

//     global.services.logService.log({
//       type: 'AUDIT', severity: 'INFO',
//       user: userId, role: role,
//       action: 'LOGOUT', message: 'User logged out'
//     });
//     res.json({ success: true });
//   });
// });

// router.get('/status', (req, res) => {
//   res.json({ 
//     authenticated: !!req.session.userId,
//     username: req.session.userId || null,
//     role: req.session.role || null // 👈 include role
//   });
// });

// router.get('/sessions', (req, res) => {
//   if (req.session?.role !== 'admin') {
//     return res.status(403).json({ error: 'Admin only' });
//   }
//   res.json(global.services?.sessionRegistry?.getAll() ?? []);
// });
// // TEMP: Simple role switch for testing (remove in production)
// router.post('/switch-role', (req, res) => {
//   const { role } = req.body;

//   if (!['operator', 'admin'].includes(role)) {
//     return res.status(400).json({ error: 'Invalid role' });
//   }

//   req.session.role = role;
//   res.json({ success: true, role });
// });

// module.exports = router;

// backend/node/routes/api/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const router  = express.Router();
const { getDbPool } = require('../../services/db');
const { requireRole } = require('../../middleware/requireRole');

// ── helpers ──────────────────────────────────────────────────────────────────
async function findUser(username) {
  const pool = await getDbPool();
  const [rows] = await pool.query(
    'SELECT * FROM scada_users WHERE username = ? AND active = 1 LIMIT 1',
    [username]
  );
  return rows[0] ?? null;
}

async function findUserById(id) {
  const pool = await getDbPool();
  const [rows] = await pool.query(
    'SELECT * FROM scada_users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const user = await findUser(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Force password change on first login
    if (user.must_change_password) {
      req.session.pendingUserId = user.id;
      return res.json({ success: false, mustChangePassword: true });
    }

    req.session.userId = user.username;
    req.session.role   = user.role;

    global.services?.sessionRegistry?.register(req.sessionID, user.username, user.role);
    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: user.username, role: user.role,
      action: 'LOGIN', message: 'User logged in'
    });

    return res.json({ success: true, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const userId    = req.session?.userId   ?? 'unknown';
  const role      = req.session?.role     ?? 'unknown';
  const sessionId = req.sessionID;

  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ success: false });
    }
    global.services?.sessionRegistry?.remove(sessionId);
    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: userId, role,
      action: 'LOGOUT', message: 'User logged out'
    });
    res.json({ success: true });
  });
});

// ── GET /api/auth/status ──────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    authenticated: !!req.session.userId,
    username:      req.session.userId ?? null,
    role:          req.session.role   ?? null,
  });
});

// ── GET /api/auth/sessions  (admin only) ─────────────────────────────────────
router.get('/sessions', requireRole('admin'), (req, res) => {
  res.json(global.services?.sessionRegistry?.getAll() ?? []);
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
// Used for:
//   (a) force-change on first login  (session.pendingUserId set, not yet logged in)
//   (b) voluntary change by a logged-in user
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Determine which user is changing their password
    const userId = req.session.pendingUserId ?? null;
    const loggedInUsername = req.session.userId ?? null;

    let user;
    if (userId) {
      user = await findUserById(userId);
    } else if (loggedInUsername) {
      user = await findUser(loggedInUsername);
    } else {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // For voluntary change, verify current password
    if (loggedInUsername && !userId) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const pool = await getDbPool();
    await pool.query(
      'UPDATE scada_users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?',
      [newHash, user.id]
    );

    // Complete login if this was a forced change
    if (userId && !loggedInUsername) {
      delete req.session.pendingUserId;
      req.session.userId = user.username;
      req.session.role   = user.role;
      global.services?.sessionRegistry?.register(req.sessionID, user.username, user.role);
      global.services?.logService?.log({
        type: 'AUDIT', severity: 'INFO',
        user: user.username, role: user.role,
        action: 'PASSWORD_CHANGE', message: 'Forced password change completed'
      });
      return res.json({ success: true, loginCompleted: true, role: user.role });
    }

    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: user.username, role: user.role,
      action: 'PASSWORD_CHANGE', message: 'User changed password'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/reset-password  (admin only) ──────────────────────────────
// Admin resets a user's password → user must change on next login
router.post('/reset-password', requireRole('admin'), async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'username and newPassword (≥8 chars) required' });
    }

    const user = await findUser(username);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const hash = bcrypt.hashSync(newPassword, 10);
    const pool = await getDbPool();
    await pool.query(
      'UPDATE scada_users SET password_hash = ?, must_change_password = 1, updated_at = NOW() WHERE id = ?',
      [hash, user.id]
    );

    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: req.session.userId, role: req.session.role,
      action: 'RESET_PASSWORD',
      message: `Admin reset password for ${username}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/auth/users  (admin only) ─────────────────────────────────────────
router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const pool = await getDbPool();
    const [rows] = await pool.query(
      `SELECT id, username, display_name, role, active, must_change_password,
              created_at, updated_at
       FROM scada_users
       ORDER BY role DESC, username ASC`
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('users list error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/users  (admin only — create user) ─────────────────────────
router.post('/users', requireRole('admin'), async (req, res) => {
  try {
    const { username, display_name, password, role } = req.body;
    const VALID_ROLES = ['operator', 'supervisor', 'admin'];

    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'username, password, role required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
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
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      `INSERT INTO scada_users (username, display_name, password_hash, role, active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 1)`,
      [username, display_name ?? username, hash, role]
    );

    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: req.session.userId, role: req.session.role,
      action: 'CREATE_USER',
      message: `Created user ${username} with role ${role}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('create user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PATCH /api/auth/users/:username  (admin only — update role / active) ──────
router.patch('/users/:username', requireRole('admin'), async (req, res) => {
  try {
    const { username } = req.params;
    const { role, active, display_name } = req.body;
    const VALID_ROLES = ['operator', 'supervisor', 'admin'];

    // Prevent admin from demoting/deactivating themselves
    if (username === req.session.userId && (role || active === false || active === 0)) {
      return res.status(400).json({ success: false, message: 'Cannot modify your own role or active status' });
    }

    const pool = await getDbPool();
    const updates = [];
    const params  = [];

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
      updates.push('role = ?');   params.push(role);
    }
    if (active !== undefined) {
      updates.push('active = ?'); params.push(active ? 1 : 0);
    }
    if (display_name !== undefined) {
      updates.push('display_name = ?'); params.push(display_name);
    }
    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    updates.push('updated_at = NOW()');
    params.push(username);

    await pool.query(
      `UPDATE scada_users SET ${updates.join(', ')} WHERE username = ?`,
      params
    );

    global.services?.logService?.log({
      type: 'AUDIT', severity: 'INFO',
      user: req.session.userId, role: req.session.role,
      action: 'UPDATE_USER',
      message: `Updated user ${username}: ${JSON.stringify({ role, active, display_name })}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('update user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;