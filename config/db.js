// config/db.js
const mysql = require('mysql2/promise');   // ← Changed to promise version
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,        // ← Better: use env variable
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
});

// Test connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connected Successfully');
    connection.release();
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
    console.error('Please check your Railway environment variables and cPanel Remote MySQL settings.');
  }
})();

module.exports = pool;