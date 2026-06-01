// routes/quotation_items.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads/quotation_items');
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

// GET all quotation items (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, item_name, price, car_name, car_model, car_year, image_filename,
            active, \`order\`, created_at
     FROM admin_quotation_items
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET active quotation items (public / frontend)
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, item_name, price, car_name, car_model, car_year, image_filename, \`order\`
     FROM admin_quotation_items
     WHERE active = 1
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST new quotation item
router.post('/', protect, upload.single('image'), (req, res) => {
  const { item_name, price, car_name, car_model, car_year, order, active } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!item_name || !price) {
    return res.status(400).json({ message: 'Item name and price are required' });
  }

  db.query(
    `INSERT INTO admin_quotation_items 
     (item_name, price, car_name, car_model, car_year, image_filename, \`order\`, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item_name,
      Number(price),
      car_name || null,
      car_model || null,
      car_year ? Number(car_year) : null,
      image,
      order ? Number(order) : 999,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Quotation item added', id: result.insertId });
    }
  );
});

// PUT update
router.put('/:id', protect, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { item_name, price, car_name, car_model, car_year, order, active } = req.body;

  let query = `UPDATE admin_quotation_items SET item_name = ?, price = ?`;
  const params = [item_name, Number(price)];

  if (car_name !== undefined) { query += `, car_name = ?`; params.push(car_name || null); }
  if (car_model !== undefined) { query += `, car_model = ?`; params.push(car_model || null); }
  if (car_year !== undefined) { query += `, car_year = ?`; params.push(car_year ? Number(car_year) : null); }
  if (req.file) { query += `, image_filename = ?`; params.push(req.file.filename); }
  if (order !== undefined) { query += `, \`order\` = ?`; params.push(Number(order)); }
  if (active !== undefined) { query += `, active = ?`; params.push(active ? 1 : 0); }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Quotation item updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM admin_quotation_items WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Quotation item deleted' });
  });
});

// Toggle active
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE admin_quotation_items SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Quotation item ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;