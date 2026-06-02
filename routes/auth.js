// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  let connection;

  try {
    console.log(`Login attempt for username: ${username}`);

    // Explicitly grab and release connection
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    connection.release();  // ✅ Release right after query — do not wait until end
    connection = null;

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = results[0];

    // Fix $2y$ → $2b$ (PHP bcrypt compatibility)
    const hash = user.password.replace(/^\$2y\$/, '$2b$');
    const isMatch = await bcrypt.compare(password, hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables!');
      return res.status(500).json({ message: 'Server misconfiguration.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        photo: user.photo || null,
      },
    });

  } catch (error) {
    // ✅ Always release on error
    if (connection) {
      connection.release();
      connection = null;
    }

    console.error('=== LOGIN ERROR ===');
    console.error('Code:   ', error.code || 'N/A');
    console.error('Message:', error.message);
    console.error('Stack:  ', error.stack);

    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      message: isDev
        ? `Server error: ${error.code || error.message}`
        : 'Server error. Please try again later.',
    });
  }
});

module.exports = router;