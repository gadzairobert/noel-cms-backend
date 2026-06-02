// routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads/users');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created uploads/users folder');
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, gif) are allowed'));
  }
});

// ==================== GET ALL USERS ====================
router.get('/', protect, (req, res) => {
  console.log('GET /users route hit');

  db.query(
    'SELECT id, username, email, photo, role, active, created_at, last_login FROM users ORDER BY created_at DESC',
    (err, results) => {
      if (err) {
        console.error('=== GET USERS ERROR ===');
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        return res.status(500).json({ 
          message: 'Failed to load users', 
          error: err.message 
        });
      }
      console.log(`✅ Successfully fetched ${results.length} users`);
      res.json(results);
    }
  );
});

// ==================== CREATE USER ====================
router.post('/', protect, (req, res, next) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const { username, password, email, role } = req.body;
    const photo = req.file ? req.file.filename : null;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    try {
      const hashed = await bcrypt.hash(password, 10);

      db.query(
        'INSERT INTO users (username, password, email, photo, role) VALUES (?, ?, ?, ?, ?)',
        [username, hashed, email || null, photo, role || 'admin'],
        (err, result) => {
          if (err) {
            console.error('Insert error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ message: 'Username already exists' });
            }
            return res.status(500).json({ message: 'Database insert failed' });
          }
          res.status(201).json({ 
            message: 'User created successfully',
            id: result.insertId 
          });
        }
      );
    } catch (err) {
      console.error('Hashing error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// ==================== UPDATE USER ====================
router.put('/:id', protect, (req, res, next) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    const { id } = req.params;
    const { username, password, email, role } = req.body;
    const photo = req.file ? req.file.filename : null;

    let query = 'UPDATE users SET username = ?, email = ?, role = ?';
    const params = [username, email || null, role || 'admin'];

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashed);
    }
    if (photo) {
      query += ', photo = ?';
      params.push(photo);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.query(query, params, (err, result) => {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ message: 'Update failed' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ message: 'User updated successfully' });
    });
  });
});

// ==================== DELETE USER ====================
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Delete failed' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// ==================== TOGGLE ACTIVE ====================
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  db.query(
    'UPDATE users SET active = ? WHERE id = ?', 
    [active ? 1 : 0, id], 
    (err, result) => {
      if (err) {
        console.error('Toggle active error:', err);
        return res.status(500).json({ message: 'Update failed' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ message: 'Status updated successfully' });
    }
  );
});

module.exports = router;