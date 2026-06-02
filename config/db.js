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
  connectionLimit: 5,           // Keep low — cPanel has strict limits
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
});

// Test connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connected Successfully');
    connection.release();
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
    console.error('Check Railway env variables and cPanel Remote MySQL settings.');
  }
})();

// Retry helper — exported so any route can use it
pool.executeWithRetry = async function (query, params, retries = 3) {
  const RETRYABLE_CODES = [
    'PROTOCOL_CONNECTION_LOST',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ER_CON_COUNT_ERROR',
    'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  ];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.execute(query, params);
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.includes(err.code);
      console.warn(`DB attempt ${attempt}/${retries} failed — code: ${err.code}, message: ${err.message}`);

      if (isRetryable && attempt < retries) {
        const delay = 300 * attempt; // 300ms, 600ms, 900ms
        console.warn(`Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Not retryable, or out of retries — rethrow
      throw err;
    }
  }
};

module.exports = pool;