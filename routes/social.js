// routes/social.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all social links (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, \`order\`, created_at 
       FROM social_links 
       ORDER BY \`order\` ASC, platform ASC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get social links error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET active social links grouped by placement (public)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, \`order\`
       FROM social_links 
       WHERE active = 1 
       ORDER BY \`order\` ASC, platform ASC`
    );
    res.json({
      nav:     results.filter(r => r.show_in_nav),
      footer:  results.filter(r => r.show_in_footer),
      contact: results.filter(r => r.show_in_contact),
    });
  } catch (err) {
    console.error('Get active social links error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST create
router.post('/', protect, async (req, res) => {
  try {
    const { platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, order } = req.body;

    if (!platform || !url || !icon_class) {
      return res.status(400).json({ message: 'Platform, URL, and icon class required' });
    }

    const [result] = await db.query(
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
      ]
    );
    res.status(201).json({ message: 'Social link created', id: result.insertId });
  } catch (err) {
    console.error('Create social link error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, url, icon_class, show_in_nav, show_in_footer, show_in_contact, active, order } = req.body;

    let query = `UPDATE social_links SET platform = ?, url = ?, icon_class = ?`;
    const params = [platform, url, icon_class];

    if (show_in_nav !== undefined)     { query += `, show_in_nav = ?`;     params.push(show_in_nav ? 1 : 0); }
    if (show_in_footer !== undefined)  { query += `, show_in_footer = ?`;  params.push(show_in_footer ? 1 : 0); }
    if (show_in_contact !== undefined) { query += `, show_in_contact = ?`; params.push(show_in_contact ? 1 : 0); }
    if (active !== undefined)          { query += `, active = ?`;          params.push(active ? 1 : 0); }
    if (order !== undefined)           { query += `, \`order\` = ?`;       params.push(order); }

    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Social link updated' });
  } catch (err) {
    console.error('Update social link error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM social_links WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Social link deleted' });
  } catch (err) {
    console.error('Delete social link error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE social_links SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Link ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle social link error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;