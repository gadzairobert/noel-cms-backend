// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder
const uploadDir = path.join(__dirname, '../uploads/products');
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
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpe?g|png|webp/i.test(path.extname(file.originalname));
    cb(null, ok);
  }
});

// GET all products (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, title, slug, description, price, image_filename, category, stock, active, \`order\`, created_at
       FROM products ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET active products (public / frontend)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, title, slug, description, price, image_filename, category, \`order\`
       FROM products WHERE active = 1 ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get active products error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new product
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, slug, description, price, category, stock, order, active } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!title || !slug || !price) {
      return res.status(400).json({ message: 'Title, slug, and price required' });
    }

    const [result] = await db.query(
      `INSERT INTO products (title, slug, description, price, image_filename, category, stock, \`order\`, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        slug,
        description || null,
        parseFloat(price),
        image,
        category || null,
        stock ? parseInt(stock) : 0,
        order ? Number(order) : 999,
        active !== false ? 1 : 0
      ]
    );
    res.status(201).json({ message: 'Product created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Slug already exists' });
    }
    console.error('Create product error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update product
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, description, price, category, stock, order, active } = req.body;

    let query = `UPDATE products SET title = ?, slug = ?`;
    const params = [title, slug];

    if (description !== undefined) { query += `, description = ?`;    params.push(description || null); }
    if (price !== undefined)       { query += `, price = ?`;          params.push(parseFloat(price)); }
    if (req.file)                  { query += `, image_filename = ?`; params.push(req.file.filename); }
    if (category !== undefined)    { query += `, category = ?`;       params.push(category || null); }
    if (stock !== undefined)       { query += `, stock = ?`;          params.push(parseInt(stock)); }
    if (order !== undefined)       { query += `, \`order\` = ?`;      params.push(Number(order)); }
    if (active !== undefined)      { query += `, active = ?`;         params.push(active ? 1 : 0); }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Slug already exists' });
    }
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE products SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Product ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle product error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;