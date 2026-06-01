// routes/testimonials.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
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
    const allowed = /jpe?g|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// GET all testimonials (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, name, position, company, photo_filename, content, rating,
            show_on_pages, active, \`order\`, created_at
     FROM testimonials
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET active testimonials (public / frontend)
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, name, position, company, photo_filename, content, rating, \`order\`
     FROM testimonials
     WHERE active = 1
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST new testimonial
router.post('/', protect, upload.single('photo'), (req, res) => {
  const { name, position, company, content, rating, show_on_pages, order, active } = req.body;
  const photo = req.file ? req.file.filename : null;

  if (!name || !content) {
    return res.status(400).json({ message: 'Name and content are required' });
  }

  db.query(
    `INSERT INTO testimonials 
     (name, position, company, photo_filename, content, rating, show_on_pages, \`order\`, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      position || null,
      company || null,
      photo,
      content,
      rating ? Number(rating) : 5,
      show_on_pages || null,
      order ? Number(order) : 999,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Testimonial added', id: result.insertId });
    }
  );
});

// PUT update
router.put('/:id', protect, upload.single('photo'), (req, res) => {
  const { id } = req.params;
  const { name, position, company, content, rating, show_on_pages, order, active } = req.body;

  let query = `UPDATE testimonials SET name = ?, content = ?`;
  const params = [name, content];

  if (position !== undefined) { query += `, position = ?`; params.push(position || null); }
  if (company !== undefined)   { query += `, company = ?`; params.push(company || null); }
  if (req.file)                { query += `, photo_filename = ?`; params.push(req.file.filename); }
  if (rating !== undefined)    { query += `, rating = ?`; params.push(Number(rating)); }
  if (show_on_pages !== undefined) { query += `, show_on_pages = ?`; params.push(show_on_pages || null); }
  if (order !== undefined)     { query += `, \`order\` = ?`; params.push(Number(order)); }
  if (active !== undefined)    { query += `, active = ?`; params.push(active ? 1 : 0); }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Testimonial updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM testimonials WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Testimonial deleted' });
  });
});

// Toggle active
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE testimonials SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Testimonial ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;