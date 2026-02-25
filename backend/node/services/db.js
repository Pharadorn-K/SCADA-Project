// backend/node/services/db.js
const mysql = require('mysql2/promise');

let dbPool = null;

async function getDbPool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || '10.207.1.87',
      user: process.env.DB_USER || 'PESET123',
      password: process.env.DB_PASS || '123456',
      database: process.env.DB_NAME || 'scada',
      waitForConnections: true,
      connectionLimit: 5
    });
  }
  return dbPool;
}

module.exports = { getDbPool };