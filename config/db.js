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
  idleTimeout: 60000,          // Kill idle connections after 60s
  maxIdle: 2,                  // Keep max 2 idle connections ready
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

// Retry helper — available to any route via db.executeWithRetry()
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
    let connection;
    try {
      connection = await pool.getConnection();
      const result = await connection.execute(query, params);
      connection.release();
      connection = null;
      return result;
    } catch (err) {
      if (connection) {
        connection.release();
        connection = null;
      }

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