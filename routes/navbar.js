// routes/navbar.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all navbar items (admin sees everything)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, label, link, parent_id, \`order\`, active, created_at 
     FROM navbar 
     ORDER BY \`order\` ASC, label ASC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET tree-structured navbar (for frontend public use - only active items)
router.get('/tree', (req, res) => {   // ← NO protect → public endpoint
  db.query(
    `SELECT id, label, link, parent_id, \`order\`, active 
     FROM navbar 
     WHERE active = 1 
     ORDER BY \`order\` ASC, label ASC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Build tree
      const itemsById = {};
      const roots = [];

      results.forEach(item => {
        itemsById[item.id] = { ...item, children: [] };
      });

      results.forEach(item => {
        if (item.parent_id === null) {
          roots.push(itemsById[item.id]);
        } else if (itemsById[item.parent_id]) {
          itemsById[item.parent_id].children.push(itemsById[item.id]);
        }
      });

      // Sort children too
      roots.forEach(root => {
        root.children.sort((a, b) => a.order - b.order);
      });

      res.json(roots);
    }
  );
});

// POST - create new nav item
router.post('/', protect, (req, res) => {
  const { label, link, parent_id, order, active } = req.body;

  if (!label || !link) {
    return res.status(400).json({ message: 'Label and link are required' });
  }

  const parent = parent_id || null;
  const pos = order !== undefined ? order : 999; // large number = end

  db.query(
    'INSERT INTO navbar (label, link, parent_id, `order`, active) VALUES (?, ?, ?, ?, ?)',
    [label, link, parent, pos, active !== false ? 1 : 0],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Navbar item created', id: result.insertId });
    }
  );
});

// PUT - update nav item
router.put('/:id', protect, (req, res) => {
  const { id } = req.params;
  const { label, link, parent_id, order, active } = req.body;

  let query = 'UPDATE navbar SET label = ?, link = ?';
  const params = [label, link];

  if (parent_id !== undefined) {
    query += ', parent_id = ?';
    params.push(parent_id || null);
  }
  if (order !== undefined) {
    query += ', `order` = ?';
    params.push(order);
  }
  if (active !== undefined) {
    query += ', active = ?';
    params.push(active ? 1 : 0);
  }

  query += ' WHERE id = ?';
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Navbar item updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM navbar WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Navbar item deleted' });
  });
});

// PUT toggle active status
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  db.query(
    'UPDATE navbar SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
      res.json({ message: `Item ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;