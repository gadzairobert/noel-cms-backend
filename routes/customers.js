// routes/customers.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/auth');

function toBool(val, fallback = 0) {
  if (val === true  || val === 1  || val === '1'  || val === 'true')  return 1;
  if (val === false || val === 0  || val === '0'  || val === 'false') return 0;
  return fallback;
}

// GET all customers
router.get('/', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.execute(`
      SELECT id, first_name, last_name, email, phone,
             address, city, province, postal_code,
             is_active, email_verified,
             last_login, created_at, updated_at
      FROM customers ORDER BY created_at DESC
    `);
    connection.release(); connection = null;
    res.json(rows);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /customers error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET single customer
router.get('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.execute(
      `SELECT id, first_name, last_name, email, phone,
              address, city, province, postal_code,
              is_active, email_verified,
              last_login, created_at, updated_at
       FROM customers WHERE id = ?`,
      [req.params.id]
    );
    connection.release(); connection = null;
    if (!rows.length) return res.status(404).json({ message: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /customers/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET customer orders
router.get('/:id/orders', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.execute(
      `SELECT id, order_number, total, status, payment_status, payment_method, created_at
       FROM orders WHERE customer_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    connection.release(); connection = null;
    res.json(rows);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /customers/:id/orders error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update customer
router.put('/:id', protect, async (req, res) => {
  const { first_name, last_name, email, phone, address, city, province, postal_code, is_active } = req.body;

  if (!first_name || !email) {
    return res.status(400).json({ message: 'First name and email are required' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    // Check duplicate email
    const [existing] = await connection.execute(
      'SELECT id FROM customers WHERE email = ? AND id != ?',
      [email, req.params.id]
    );
    if (existing.length) {
      connection.release(); connection = null;
      return res.status(400).json({ message: 'Another account already uses that email address' });
    }

    const [result] = await connection.execute(
      `UPDATE customers SET
         first_name=?, last_name=?, email=?, phone=?,
         address=?, city=?, province=?, postal_code=?,
         is_active=?, updated_at=NOW()
       WHERE id=?`,
      [
        first_name, last_name || '', email, phone || null,
        address || null, city || null, province || null, postal_code || null,
        toBool(is_active, 1), req.params.id,
      ]
    );
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /customers/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'UPDATE customers SET is_active=?, updated_at=NOW() WHERE id=?',
      [toBool(req.body.is_active, 0), req.params.id]
    );
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer status updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /customers/:id/toggle-active error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// DELETE customer
router.delete('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.execute(
      'SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ?',
      [req.params.id]
    );
    const orderCount = rows[0]?.cnt || 0;
    const force = req.query.force === '1';

    if (orderCount > 0 && !force) {
      connection.release(); connection = null;
      return res.status(409).json({
        message: `This customer has ${orderCount} order(s). Add ?force=1 to delete anyway.`,
        order_count: orderCount,
      });
    }

    const [result] = await connection.execute(
      'DELETE FROM customers WHERE id=?',
      [req.params.id]
    );
    connection.release(); connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('DELETE /customers/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;