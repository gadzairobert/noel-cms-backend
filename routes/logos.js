// routes/logos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpe?g|png|webp|svg/i.test(path.extname(file.originalname));
    cb(null, ok);
  }
});

// ────────────────────────────────────────────────
// PUBLIC ROUTE — no authentication required
// Returns only ACTIVE logos (usually for frontend)
// ────────────────────────────────────────────────
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, title, alt_text, image_filename, placement, active, \`order\`, created_at, updated_at
     FROM logos 
     WHERE active = 1
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) {
        console.error('Active logos query error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);  // returns array – usually 0 or 1 item
    }
  );
});

// ────────────────────────────────────────────────
// Protected admin routes below – keep protect
// ────────────────────────────────────────────────

// GET all logos (admin only)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, title, alt_text, image_filename, placement, active, \`order\`, created_at
     FROM logos ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST new logo
router.post('/', protect, upload.single('image'), (req, res) => {
  const { title, alt_text, placement, order, active } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!image) return res.status(400).json({ message: 'Image required' });

  db.query(
    `INSERT INTO logos (title, alt_text, image_filename, placement, \`order\`, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      title || null,
      alt_text || null,
      image,
      placement || 'both',
      order ? Number(order) : 0,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Logo added', id: result.insertId });
    }
  );
});

// PUT update logo
router.put('/:id', protect, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, alt_text, placement, order, active } = req.body;

  let query = `UPDATE logos SET title = COALESCE(?, title)`;
  const params = [title];

  if (alt_text !== undefined) { query += `, alt_text = ?`; params.push(alt_text); }
  if (placement !== undefined) { query += `, placement = ?`; params.push(placement); }
  if (order !== undefined)     { query += `, \`order\` = ?`; params.push(Number(order)); }
  if (active !== undefined)    { query += `, active = ?`; params.push(active ? 1 : 0); }
  if (req.file)                { query += `, image_filename = ?`; params.push(req.file.filename); }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Logo not found' });
    res.json({ message: 'Logo updated' });
  });
});

// DELETE logo
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM logos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Logo deleted' });
  });
});

// Toggle active
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE logos SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Logo ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;