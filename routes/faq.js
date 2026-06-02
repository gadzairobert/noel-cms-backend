// routes/faq.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

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
    cb(null, /jpe?g|png|webp/.test(path.extname(file.originalname).toLowerCase()));
  }
});

// GET all FAQs (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      'SELECT id, title, description, image_filename, `order`, active, created_at FROM faq ORDER BY `order` ASC, id DESC'
    );
    res.json(results);
  } catch (err) {
    console.error('GET /faq error:', err.code, err.message);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// GET active FAQs (public)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      'SELECT id, title, description, image_filename, `order` FROM faq WHERE active = 1 ORDER BY `order` ASC, id DESC'
    );
    res.json(results);
  } catch (err) {
    console.error('GET /faq/active error:', err.code, err.message);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// POST new FAQ
router.post('/', protect, upload.single('image'), async (req, res) => {
  const { title, description, order, active } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO faq (title, description, image_filename, `order`, active) VALUES (?, ?, ?, ?, ?)',
      [title, description, image, order ? Number(order) : 999, active !== false ? 1 : 0]
    );
    res.status(201).json({ message: 'FAQ added', id: result.insertId });
  } catch (err) {
    console.error('POST /faq error:', err.code, err.message);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// PUT update FAQ
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  const { title, description, order, active } = req.body;
  let query = 'UPDATE faq SET title = ?, description = ?';
  const params = [title, description];

  if (req.file)             { query += ', image_filename = ?'; params.push(req.file.filename); }
  if (order !== undefined)  { query += ', `order` = ?';        params.push(Number(order)); }
  if (active !== undefined) { query += ', active = ?';         params.push(active ? 1 : 0); }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  try {
    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'FAQ updated' });
  } catch (err) {
    console.error('PUT /faq/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

// DELETE FAQ
router.delete('/:id', protect, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM faq WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'FAQ deleted' });
  } catch (err) {
    console.error('DELETE /faq/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

// PUT toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const [result] = await db.query(
      'UPDATE faq SET active = ? WHERE id = ?',
      [req.body.active ? 1 : 0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `FAQ ${req.body.active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('PUT /faq/:id/toggle-active error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

module.exports = router;