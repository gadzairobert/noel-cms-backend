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
      [email.trim().toLowerCase(), name?.trim() || null],
      (err) => {
        if (err && err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Already subscribed' });
        }
        if (err) throw err;
        res.status(201).json({ message: 'Subscribed successfully' });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ADMIN: Get all subscribers
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, email, name, subscribed_at, active, last_sent, notes
     FROM newsletters ORDER BY subscribed_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// ADMIN: Delete subscriber
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM newsletters WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Subscriber deleted' });
  });
});

// ADMIN: Toggle active (optional - e.g. unsubscribe temporarily)
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE newsletters SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Subscriber ${active ? 'reactivated' : 'deactivated'}` });
    }
  );
});

module.exports = router;