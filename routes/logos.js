// routes/logos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

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
    cb(null, /jpe?g|png|webp|svg/i.test(path.extname(file.originalname)));
  }
});

// GET active logos (public)
router.get('/active', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT id, title, alt_text, image_filename, placement, active, `order`, created_at, updated_at FROM logos WHERE active = 1 ORDER BY `order` ASC, id DESC'
    );
    connection.release(); connection = null;
    res.json(results);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /logos/active error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET all logos (admin)
router.get('/', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT id, title, alt_text, image_filename, placement, active, `order`, created_at FROM logos ORDER BY `order` ASC, id DESC'
    );
    connection.release(); connection = null;
    res.json(results);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /logos error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new logo
router.post('/', protect, upload.single('image'), async (req, res) => {
  const { title, alt_text, placement, order, active } = req.body;
  const image = req.file ? req.file.filename : null;
  if (!image) return res.status(400).json({ message: 'Image required' });

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO logos (title, alt_text, image_filename, placement, `order`, active) VALUES (?, ?, ?, ?, ?, ?)',
      [title || null, alt_text || null, image, placement || 'both', order ? Number(order) : 0, active !== false ? 1 : 0]
    );
    connection.release(); connection = null;
    res.status(201).json({ message: 'Logo added', id: result.insertId });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('POST /logos error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update logo
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  const { title, alt_text, placement, order, active } = req.body;
  let query = 'UPDATE logos SET title = COALESCE(?, title)';
  const params = [title];

  if (alt_text !== undefined)  { query += ', alt_text = ?';    params.push(alt_text); }
  if (placement !== undefined) { query += ', placement = ?';   params.push(placement); }
  if (order !== undefined)     { query += ', `order` = ?';     params.push(Number(order)); }
  if (active !== undefined)    { query += ', active = ?';      params.push(active ? 1 : 0); }
  if (req.file)                { query += ', image_filename = ?'; params.push(req.file.filename); }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(query, params);
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Logo not found' });
    res.json({ message: 'Logo updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /logos/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE logo
router.delete('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute('DELETE FROM logos WHERE id = ?', [req.params.id]);
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Logo deleted' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('DELETE /logos/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// PUT toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'UPDATE logos SET active = ? WHERE id = ?',
      [req.body.active ? 1 : 0, req.params.id]
    );
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Logo ${req.body.active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /logos/:id/toggle-active error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;