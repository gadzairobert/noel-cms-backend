// routes/slideshow.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads/slideshow');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// GET all slides (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, title, subtitle, image_filename, button_text, button_link, \`order\`, active, created_at
     FROM slideshow ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET only active slides (public / frontend use)
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, title, subtitle, image_filename, button_text, button_link, \`order\`
     FROM slideshow WHERE active = 1 ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST - create new slide
router.post('/', protect, upload.single('image'), (req, res) => {
  const { title, subtitle, button_text, button_link, order, active } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!image) return res.status(400).json({ message: 'Image file required' });

  db.query(
    `INSERT INTO slideshow (title, subtitle, image_filename, button_text, button_link, \`order\`, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title || null,
      subtitle || null,
      image,
      button_text || null,
      button_link || null,
      order ? Number(order) : 999,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Slide created', id: result.insertId });
    }
  );
});

// PUT - update slide (image is optional)
router.put('/:id', protect, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, subtitle, button_text, button_link, order, active } = req.body;

  let query = `UPDATE slideshow SET title = ?, subtitle = ?, button_text = ?, button_link = ?`;
  const params = [title || null, subtitle || null, button_text || null, button_link || null];

  if (req.file) {
    query += `, image_filename = ?`;
    params.push(req.file.filename);
  }
  if (order !== undefined) {
    query += `, \`order\` = ?`;
    params.push(Number(order));
  }
  if (active !== undefined) {
    query += `, active = ?`;
    params.push(active ? 1 : 0);
  }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Slide not found' });
    res.json({ message: 'Slide updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM slideshow WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Slide not found' });
    res.json({ message: 'Slide deleted' });
  });
});

// Toggle active status
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE slideshow SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Slide not found' });
      res.json({ message: `Slide ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;