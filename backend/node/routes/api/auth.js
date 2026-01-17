// backend/node/routes/api/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Hardcoded user for demo (replace with DB in real app)
const VALID_USERS = [
  { 
    username: 'admin', 
    passwordHash: '$2b$10$dcsYRXvpYuRZ2nJ1Z0.R6.IYGum/iFKQol/.x6yGY8LoX23SF5Li2', //'scada123'
    role: 'admin' 
  },
  {
    username: 'operator',
    passwordHash: '$2b$10$KtV1W2Djxtgv8ap3IAxMPeP7vWgt.uQyhxY7HyC30i0vfcV05k.cK', //'user2026'
    role: 'operator'
  }
];


router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password }); // ← see what's received

  const user = VALID_USERS.find(u => u.username === username);
  if (user) {
    console.log('Stored hash:', user.passwordHash);
    console.log('Password matches?', bcrypt.compareSync(password, user.passwordHash));
  }

  // In /login route
  if (user && bcrypt.compareSync(password, user.passwordHash)) {
    req.session.userId = username;
    req.session.role = user.role; // 👈 store role
    global.services.logService.log({
      type: 'AUDIT',
      severity: 'INFO',
      user: req.session.userId || 'unknown',
      role: req.session.role || 'unknown',
      action: 'LOGIN',
      message: 'User logged in'
    });
    return res.json({ success: true });

  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
  global.services.logService.log({
    type: 'AUDIT',
    severity: 'INFO',
    user: req.session.userId || 'unknown',
    role: req.session.role || 'unknown',
    action: 'LOGOUT',
    message: 'User logged out'
  });
});

router.get('/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.userId,
    username: req.session.userId || null,
    role: req.session.role || null // 👈 include role
  });
});

// TEMP: Simple role switch for testing (remove in production)
router.post('/switch-role', (req, res) => {
  const { role } = req.body;

  if (!['operator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  req.session.role = role;
  res.json({ success: true, role });
});

module.exports = router;