// config/db.js
const mysql = require('mysql2/promise');   // ← better to use promise version
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: 3306,                    // ← ADD THIS
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

// Test connection
async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('✅ MySQL Connected Successfully');
    connection.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    // Do NOT process.exit(1) in production
  }
}

testConnection();

module.exports = db;