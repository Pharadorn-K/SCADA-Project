// backend/node/routes/api/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Hardcoded user for demo (replace with DB in real app)
const VALID_USERS = [
  { 
    username: 'admin', 
    passwordHash: '$2b$10$dcsYRXvpYuRZ2nJ1Z0.R6.IYGum/iFKQol/.x6yGY8LoX23SF5Li2'
  } // hash of 'scada123' 
];

// router.post('/login', (req, res) => {
//   const { username, password } = req.body;
//   const user = VALID_USERS.find(u => u.username === username);
  
//   if (user && bcrypt.compareSync(password, user.passwordHash)) {
//     req.session.userId = username; // Store minimal info
//     return res.json({ success: true });
//   }
//   res.status(401).json({ success: false, message: 'Invalid credentials' });
// });
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password }); // ← see what's received

  const user = VALID_USERS.find(u => u.username === username);
  if (user) {
    console.log('Stored hash:', user.passwordHash);
    console.log('Password matches?', bcrypt.compareSync(password, user.passwordHash));
  }

  if (user && bcrypt.compareSync(password, user.passwordHash)) {
    req.session.userId = username;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.userId,
    username: req.session.userId || null 
  });
});

module.exports = router;