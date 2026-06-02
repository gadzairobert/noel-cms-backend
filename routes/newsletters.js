// routes/newsletters.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// PUBLIC: Subscribe
router.post('/subscribe', async (req, res) => {
  const { email, name } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Valid email required' });
  }

  try {
    await db.query(
      'INSERT INTO newsletters (email, name) VALUES (?, ?)',
      [email.trim().toLowerCase(), name?.trim() || null]
    );
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Already subscribed' });
    }
    console.error('Subscribe error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ADMIN: Get all subscribers
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, email, name, subscribed_at, active, last_sent, notes
       FROM newsletters ORDER BY subscribed_at DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get newsletters error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ADMIN: Delete subscriber
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM newsletters WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Subscriber deleted' });
  } catch (err) {
    console.error('Delete newsletter error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// ADMIN: Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE newsletters SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Subscriber ${active ? 'reactivated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle newsletter error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;