// generate-hash.js
const bcrypt = require('bcryptjs');
const password = 'scada123';
const hash = bcrypt.hashSync(password, 10);
console.log('Hash for "scada123":', hash);
console.log('Length:', hash.length);