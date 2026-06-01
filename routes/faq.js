// routes/faq.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads/faq');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpe?g|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// GET all FAQs (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, title, description, image_filename, \`order\`, active, created_at
     FROM faq
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET active FAQs (public / frontend)
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, title, description, image_filename, \`order\`
     FROM faq
     WHERE active = 1
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST new FAQ
router.post('/', protect, upload.single('image'), (req, res) => {
  const { title, description, order, active } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' });
  }

  db.query(
    `INSERT INTO faq 
     (title, description, image_filename, \`order\`, active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      title,
      description,
      image,
      order ? Number(order) : 999,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'FAQ added', id: result.insertId });
    }
  );
});

// PUT update
router.put('/:id', protect, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, description, order, active } = req.body;

  let query = `UPDATE faq SET title = ?, description = ?`;
  const params = [title, description];

  if (req.file)                { query += `, image_filename = ?`; params.push(req.file.filename); }
  if (order !== undefined)     { query += `, \`order\` = ?`; params.push(Number(order)); }
  if (active !== undefined)    { query += `, active = ?`; params.push(active ? 1 : 0); }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'FAQ updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM faq WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'FAQ deleted' });
  });
});

// Toggle active
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE faq SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `FAQ ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;