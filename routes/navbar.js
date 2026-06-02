// routes/navbar.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all navbar items (admin)
router.get('/', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT id, label, link, parent_id, `order`, active, created_at FROM navbar ORDER BY `order` ASC, label ASC'
    );
    connection.release(); connection = null;
    res.json(results);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /navbar error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET tree (public)
router.get('/tree', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT id, label, link, parent_id, `order`, active FROM navbar WHERE active = 1 ORDER BY `order` ASC, label ASC'
    );
    connection.release(); connection = null;

    const itemsById = {};
    const roots = [];

    results.forEach(item => { itemsById[item.id] = { ...item, children: [] }; });
    results.forEach(item => {
      if (item.parent_id === null) {
        roots.push(itemsById[item.id]);
      } else if (itemsById[item.parent_id]) {
        itemsById[item.parent_id].children.push(itemsById[item.id]);
      }
    });
    roots.forEach(root => root.children.sort((a, b) => a.order - b.order));

    res.json(roots);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /navbar/tree error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST create nav item
router.post('/', protect, async (req, res) => {
  const { label, link, parent_id, order, active } = req.body;
  if (!label || !link) return res.status(400).json({ message: 'Label and link are required' });

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO navbar (label, link, parent_id, `order`, active) VALUES (?, ?, ?, ?, ?)',
      [label, link, parent_id || null, order !== undefined ? order : 999, active !== false ? 1 : 0]
    );
    connection.release(); connection = null;
    res.status(201).json({ message: 'Navbar item created', id: result.insertId });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('POST /navbar error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update nav item
router.put('/:id', protect, async (req, res) => {
  const { label, link, parent_id, order, active } = req.body;
  let query = 'UPDATE navbar SET label = ?, link = ?';
  const params = [label, link];

  if (parent_id !== undefined) { query += ', parent_id = ?'; params.push(parent_id || null); }
  if (order !== undefined)     { query += ', `order` = ?';   params.push(order); }
  if (active !== undefined)    { query += ', active = ?';    params.push(active ? 1 : 0); }

  query += ' WHERE id = ?';
  params.push(req.params.id);

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(query, params);
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Navbar item updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /navbar/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE nav item
router.delete('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute('DELETE FROM navbar WHERE id = ?', [req.params.id]);
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Navbar item deleted' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('DELETE /navbar/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// PUT toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'UPDATE navbar SET active = ? WHERE id = ?',
      [req.body.active ? 1 : 0, req.params.id]
    );
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: `Item ${req.body.active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /navbar/:id/toggle-active error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'UPDATE logos SET active = ? WHERE id = ?',
      [req.body.active ? 1 : 0, req.params.id]
    );
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Logo ${req.body.active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /logos/:id/toggle-active error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;