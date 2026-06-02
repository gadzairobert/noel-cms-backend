// routes/slideshow.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/slideshow');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  }
});

// GET all slides (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, title, subtitle, image_filename, button_text, button_link, \`order\`, active, created_at
       FROM slideshow ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get slideshow error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET active slides (public / frontend)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, title, subtitle, image_filename, button_text, button_link, \`order\`
       FROM slideshow WHERE active = 1 ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get active slideshow error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new slide
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, button_text, button_link, order, active } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!image) return res.status(400).json({ message: 'Image file required' });

    const [result] = await db.query(
      `INSERT INTO slideshow (title, subtitle, image_filename, button_text, button_link, \`order\`, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title || null, subtitle || null, image,
        button_text || null, button_link || null,
        order ? Number(order) : 999,
        active !== false ? 1 : 0
      ]
    );
    res.status(201).json({ message: 'Slide created', id: result.insertId });
  } catch (err) {
    console.error('Create slide error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update slide
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, button_text, button_link, order, active } = req.body;

    let query = `UPDATE slideshow SET title = ?, subtitle = ?, button_text = ?, button_link = ?`;
    const params = [title || null, subtitle || null, button_text || null, button_link || null];

    if (req.file)            { query += `, image_filename = ?`; params.push(req.file.filename); }
    if (order !== undefined) { query += `, \`order\` = ?`;      params.push(Number(order)); }
    if (active !== undefined){ query += `, active = ?`;         params.push(active ? 1 : 0); }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Slide not found' });
    res.json({ message: 'Slide updated' });
  } catch (err) {
    console.error('Update slide error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM slideshow WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Slide not found' });
    res.json({ message: 'Slide deleted' });
  } catch (err) {
    console.error('Delete slide error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE slideshow SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Slide not found' });
    res.json({ message: `Slide ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle slide error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;