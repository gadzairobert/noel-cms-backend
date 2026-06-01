// routes/social.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all social links (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, \`order\`, created_at 
     FROM social_links 
     ORDER BY \`order\` ASC, platform ASC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET active social links grouped by placement (for frontend use - public)
router.get('/active', (req, res) => {  // ← no auth → public
  db.query(
    `SELECT id, platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, \`order\`
     FROM social_links 
     WHERE active = 1 
     ORDER BY \`order\` ASC, platform ASC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const nav = results.filter(r => r.show_in_nav);
      const footer = results.filter(r => r.show_in_footer);
      const contact = results.filter(r => r.show_in_contact);

      res.json({ nav, footer, contact });
    }
  );
});

// POST create
router.post('/', protect, (req, res) => {
  const { platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, order } = req.body;

  if (!platform || !url || !icon_class) {
    return res.status(400).json({ message: 'Platform, URL, and icon class required' });
  }

  db.query(
    `INSERT INTO social_links 
     (platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, \`order\`) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      platform, url, icon_class,
      show_in_nav ? 1 : 0,
      show_in_footer ? 1 : 0,
      show_in_contact ? 1 : 0,
      active !== false ? 1 : 0,
      order || 999
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Social link created', id: result.insertId });
    }
  );
});

// PUT update
router.put('/:id', protect, (req, res) => {
  const { id } = req.params;
  const { platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, order } = req.body;

  let query = `UPDATE social_links SET platform = ?, url = ?, icon_class = ?`;
  const params = [platform, url, icon_class];

  if (show_in_nav !== undefined) { query += `, show_in_nav = ?`; params.push(show_in_nav ? 1 : 0); }
  if (show_in_footer !== undefined) { query += `, show_in_footer = ?`; params.push(show_in_footer ? 1 : 0); }
  if (show_in_contact !== undefined) { query += `, show_in_contact = ?`; params.push(show_in_contact ? 1 : 0); }
  if (active !== undefined) { query += `, active = ?`; params.push(active ? 1 : 0); }
  if (order !== undefined) { query += `, \`order\` = ?`; params.push(order); }

  query += ' WHERE id = ?';
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Social link updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM social_links WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Social link deleted' });
  });
});

// Toggle active
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE social_links SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Link ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;