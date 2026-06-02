// routes/testimonials.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/testimonials');
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

// GET all testimonials (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, name, position, company, photo_filename, content, rating,
              show_on_pages, active, \`order\`, created_at
       FROM testimonials
       ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get testimonials error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET active testimonials (public / frontend)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, name, position, company, photo_filename, content, rating, \`order\`
       FROM testimonials
       WHERE active = 1
       ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get active testimonials error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new testimonial
router.post('/', protect, upload.single('photo'), async (req, res) => {
  try {
    const { name, position, company, content, rating, show_on_pages, order, active } = req.body;
    const photo = req.file ? req.file.filename : null;

    if (!name || !content) {
      return res.status(400).json({ message: 'Name and content are required' });
    }

    const [result] = await db.query(
      `INSERT INTO testimonials 
       (name, position, company, photo_filename, content, rating, show_on_pages, \`order\`, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, position || null, company || null, photo, content,
        rating ? Number(rating) : 5,
        show_on_pages || null,
        order ? Number(order) : 999,
        active !== false ? 1 : 0
      ]
    );
    res.status(201).json({ message: 'Testimonial added', id: result.insertId });
  } catch (err) {
    console.error('Create testimonial error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update
router.put('/:id', protect, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, company, content, rating, show_on_pages, order, active } = req.body;

    let query = `UPDATE testimonials SET name = ?, content = ?`;
    const params = [name, content];

    if (position !== undefined)      { query += `, position = ?`;      params.push(position || null); }
    if (company !== undefined)       { query += `, company = ?`;       params.push(company || null); }
    if (req.file)                    { query += `, photo_filename = ?`; params.push(req.file.filename); }
    if (rating !== undefined)        { query += `, rating = ?`;        params.push(Number(rating)); }
    if (show_on_pages !== undefined) { query += `, show_on_pages = ?`; params.push(show_on_pages || null); }
    if (order !== undefined)         { query += `, \`order\` = ?`;     params.push(Number(order)); }
    if (active !== undefined)        { query += `, active = ?`;        params.push(active ? 1 : 0); }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Testimonial updated' });
  } catch (err) {
    console.error('Update testimonial error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM testimonials WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Testimonial deleted' });
  } catch (err) {
    console.error('Delete testimonial error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE testimonials SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Testimonial ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle testimonial error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;