// routes/text-slideshow.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all slides (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, description, \`order\`, active, created_at
     FROM text_slideshow
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET active slides (public / frontend)
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, description, \`order\`
     FROM text_slideshow
     WHERE active = 1
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST new slide
router.post('/', protect, (req, res) => {
  const { description, order, active } = req.body;

  if (!description || description.trim() === '') {
    return res.status(400).json({ message: 'Description is required' });
  }

  db.query(
    `INSERT INTO text_slideshow 
     (description, \`order\`, active)
     VALUES (?, ?, ?)`,
    [
      description.trim(),
      order ? Number(order) : 999,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Slide added', id: result.insertId });
    }
  );
});

// PUT update slide
router.put('/:id', protect, (req, res) => {
  const { id } = req.params;
  const { description, order, active } = req.body;

  let query = `UPDATE text_slideshow SET description = ?`;
  const params = [description.trim()];

  if (order !== undefined)    { query += `, \`order\` = ?`;  params.push(Number(order)); }
  if (active !== undefined)   { query += `, active = ?`;     params.push(active ? 1 : 0); }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Slide updated' });
  });
});

// DELETE
router.put('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM text_slideshow WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Slide deleted' });
  });
});

// Toggle active status
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  db.query(
    'UPDATE text_slideshow SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Slide ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;