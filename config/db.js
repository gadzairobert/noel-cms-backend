// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
  idleTimeout: 55000,   // Slightly under the 60s cPanel wait_timeout
  maxIdle: 2,
});

// Test connection on startup
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ MySQL Connected Successfully');
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
    console.error('Check Railway env variables and cPanel Remote MySQL settings.');
  }
})();

// Keep-alive ping every 30s to prevent cPanel from killing idle connections
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('🔄 DB keep-alive ping OK');
  } catch (err) {
    console.warn('⚠️ DB keep-alive ping failed:', err.code, err.message);
  }
}, 30000);

// Retry helper — available to any route via db.executeWithRetry()
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
      const result = await pool.query(query, params);
      return result;
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.includes(err.code);
      console.warn(`DB attempt ${attempt}/${retries} failed — code: ${err.code}, message: ${err.message}`);

      if (isRetryable && attempt < retries) {
        const delay = 300 * attempt; // 300ms, 600ms, 900ms
        console.warn(`Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw err;
    }
  }
};

module.exports = pool;