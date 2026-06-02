// routes/images.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/gallery');
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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /jpe?g|png|webp/i.test(path.extname(file.originalname)));
  }
});

// GET all gallery images (admin)
router.get('/', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [images] = await connection.execute(
      'SELECT id, title, description, image_filename, `order`, active, created_at FROM gallery_images ORDER BY `order` ASC, id DESC'
    );
    for (let img of images) {
      const [pages] = await connection.execute(
        'SELECT page_slug FROM gallery_image_pages WHERE image_id = ?',
        [img.id]
      );
      img.assigned_pages = pages.map(p => p.page_slug);
    }
    connection.release(); connection = null;
    res.json(images);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /images error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET images for a specific page (public)
router.get('/page/:slug', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      `SELECT gi.id, gi.title, gi.description, gi.image_filename, gi.\`order\`
       FROM gallery_images gi
       INNER JOIN gallery_image_pages gip ON gi.id = gip.image_id
       WHERE gip.page_slug = ? AND gi.active = 1
       ORDER BY gi.\`order\` ASC, gi.id DESC`,
      [req.params.slug]
    );
    connection.release(); connection = null;
    res.json(results);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /images/page/:slug error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new image
router.post('/', protect, upload.single('image'), async (req, res) => {
  const { title, description, order, active, assigned_pages } = req.body;
  const image = req.file?.filename;
  if (!image) return res.status(400).json({ message: 'Image required' });

  const pages = assigned_pages ? JSON.parse(assigned_pages) : [];

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO gallery_images (title, description, image_filename, `order`, active) VALUES (?, ?, ?, ?, ?)',
      [title || null, description || null, image, order || 999, active !== false ? 1 : 0]
    );
    const imageId = result.insertId;

    if (pages.length > 0) {
      const values = pages.map(slug => [imageId, slug]);
      await connection.query('INSERT INTO gallery_image_pages (image_id, page_slug) VALUES ?', [values]);
    }

    connection.release(); connection = null;
    res.status(201).json({ message: 'Image added', id: imageId });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('POST /images error:', err.code, err.message);
    res.status(500).json({ message: 'Failed to save image' });
  }
});

// PUT update image
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, description, order, active, assigned_pages } = req.body;

  let query = 'UPDATE gallery_images SET title = ?, description = ?';
  let params = [title || null, description || null];

  if (req.file)             { query += ', image_filename = ?'; params.push(req.file.filename); }
  if (order !== undefined)  { query += ', `order` = ?';        params.push(order); }
  if (active !== undefined) { query += ', active = ?';         params.push(active ? 1 : 0); }

  query += ' WHERE id = ?';
  params.push(id);

  let connection;
  try {
    connection = await db.getConnection();
    await connection.execute(query, params);
    await connection.execute('DELETE FROM gallery_image_pages WHERE image_id = ?', [id]);

    if (assigned_pages) {
      const pages = JSON.parse(assigned_pages);
      if (pages.length > 0) {
        const values = pages.map(slug => [id, slug]);
        await connection.query('INSERT INTO gallery_image_pages (image_id, page_slug) VALUES ?', [values]);
      }
    }

    connection.release(); connection = null;
    res.json({ message: 'Image updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /images/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE image
router.delete('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.execute('DELETE FROM gallery_images WHERE id = ?', [req.params.id]);
    connection.release(); connection = null;
    res.json({ message: 'Image deleted' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('DELETE /images/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;