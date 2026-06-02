// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: parseInt(process.env.MYSQLPORT) || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
  idleTimeout: 55000,
  maxIdle: 2,
});

// Test connection on startup
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ MySQL Connected Successfully');
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
  }
})();

// Keep-alive ping every 30s
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('⚠️ DB keep-alive ping failed:', err.code, err.message);
  }
}, 30000);

// Retry helper
const RETRYABLE_CODES = [
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ER_CON_COUNT_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
];

pool.executeWithRetry = async function (query, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(query, params);
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.includes(err.code);
      console.warn(`DB attempt ${attempt}/${retries} failed — ${err.code}: ${err.message}`);

      if (isRetryable && attempt < retries) {
        const delay = 300 * attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
};

module.exports = pool;