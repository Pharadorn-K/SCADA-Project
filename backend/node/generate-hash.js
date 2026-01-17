// generate-hash.js
const bcrypt = require('bcryptjs');
const password = 'user2026';
const hash = bcrypt.hashSync(password, 10);
console.log('Hash for "user2026":', hash);
console.log('Length:', hash.length);