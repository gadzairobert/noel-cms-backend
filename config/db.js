// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: 3306,                    // ← Very important
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testDB() {
  try {
    const connection = await db.getConnection();
    console.log('✅ MySQL Connected Successfully to cPanel DB');
    connection.release();
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
    console.error('Error Code:', err.code);
  }
}

testDB();

module.exports = db;