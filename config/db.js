// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true
});

// Test connection on startup
async function testConnection() {
  try {
    const conn = await db.getConnection();
    console.log('✅ MySQL Pool Connected Successfully');
    conn.release();
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
  }
}

testConnection();

module.exports = db;