// routes/text-slideshow.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all slides (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, description, \`order\`, active, created_at
       FROM text_slideshow
       ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get text slideshow error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET active slides (public / frontend)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, description, \`order\`
       FROM text_slideshow
       WHERE active = 1
       ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get active text slideshow error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new slide
router.post('/', protect, async (req, res) => {
  try {
    const { description, order, active } = req.body;

    if (!description || description.trim() === '') {
      return res.status(400).json({ message: 'Description is required' });
    }

    const [result] = await db.query(
      `INSERT INTO text_slideshow (description, \`order\`, active) VALUES (?, ?, ?)`,
      [
        description.trim(),
        order ? Number(order) : 999,
        active !== false ? 1 : 0
      ]
    );
    res.status(201).json({ message: 'Slide added', id: result.insertId });
  } catch (err) {
    console.error('Create text slide error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update slide
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, order, active } = req.body;

    let query = `UPDATE text_slideshow SET description = ?`;
    const params = [description.trim()];

    if (order !== undefined)  { query += `, \`order\` = ?`; params.push(Number(order)); }
    if (active !== undefined) { query += `, active = ?`;    params.push(active ? 1 : 0); }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Slide updated' });
  } catch (err) {
    console.error('Update text slide error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE  ← was incorrectly router.put in the original
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM text_slideshow WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Slide deleted' });
  } catch (err) {
    console.error('Delete text slide error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE text_slideshow SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Slide ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle text slide error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;