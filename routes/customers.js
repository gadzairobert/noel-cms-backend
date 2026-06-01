// routes/customers.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/auth');

// Helper – safely convert boolean-like values
function toBool(val, fallback = 0) {
  if (val === true  || val === 1  || val === '1'    || val === 'true')  return 1;
  if (val === false || val === 0  || val === '0'    || val === 'false') return 0;
  return fallback;
}

// ════════════════════════════════════════════════════════════
// GET /api/customers  — list all customers (admin)
// ════════════════════════════════════════════════════════════
router.get('/', protect, (req, res) => {
  const sql = `
    SELECT
      id, first_name, last_name, email, phone,
      address, city, province, postal_code,
      is_active, email_verified,
      last_login, created_at, updated_at
    FROM customers
    ORDER BY created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

// ════════════════════════════════════════════════════════════
// GET /api/customers/:id  — single customer
// ════════════════════════════════════════════════════════════
router.get('/:id', protect, (req, res) => {
  db.query(
    `SELECT id, first_name, last_name, email, phone,
            address, city, province, postal_code,
            is_active, email_verified,
            last_login, created_at, updated_at
     FROM customers WHERE id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!rows.length) return res.status(404).json({ message: 'Customer not found' });
      res.json(rows[0]);
    }
  );
});

// ════════════════════════════════════════════════════════════
// GET /api/customers/:id/orders  — orders belonging to customer
// ════════════════════════════════════════════════════════════
router.get('/:id/orders', protect, (req, res) => {
  db.query(
    `SELECT id, order_number, total, status, payment_status, payment_method, created_at
     FROM orders
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// ════════════════════════════════════════════════════════════
// PUT /api/customers/:id  — update customer details
// ════════════════════════════════════════════════════════════
router.put('/:id', protect, (req, res) => {
  const {
    first_name, last_name, email, phone,
    address, city, province, postal_code, is_active,
  } = req.body;

  if (!first_name || !email) {
    return res.status(400).json({ message: 'First name and email are required' });
  }

  // Check for duplicate email (excluding current customer)
  db.query(
    'SELECT id FROM customers WHERE email = ? AND id != ?',
    [email, req.params.id],
    (err, rows) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (rows.length) {
        return res.status(400).json({ message: 'Another account already uses that email address' });
      }

      db.query(
        `UPDATE customers SET
           first_name=?, last_name=?, email=?, phone=?,
           address=?, city=?, province=?, postal_code=?,
           is_active=?, updated_at=NOW()
         WHERE id=?`,
        [
          first_name,
          last_name    || '',
          email,
          phone        || null,
          address      || null,
          city         || null,
          province     || null,
          postal_code  || null,
          toBool(is_active, 1),
          req.params.id,
        ],
        (err2, result) => {
          if (err2) {
            console.error('Update error:', err2);
            return res.status(500).json({ message: 'Database error' });
          }
          if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });
          res.json({ message: 'Customer updated' });
        }
      );
    }
  );
});

// ════════════════════════════════════════════════════════════
// PUT /api/customers/:id/toggle-active  — activate / deactivate
// ════════════════════════════════════════════════════════════
router.put('/:id/toggle-active', protect, (req, res) => {
  const { is_active } = req.body;
  db.query(
    'UPDATE customers SET is_active=?, updated_at=NOW() WHERE id=?',
    [toBool(is_active, 0), req.params.id],
    (err, result) => {
      if (err) {
        console.error('Toggle error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });
      res.json({ message: 'Customer status updated' });
    }
  );
});

// ════════════════════════════════════════════════════════════
// DELETE /api/customers/:id
// ════════════════════════════════════════════════════════════
router.delete('/:id', protect, (req, res) => {
  // Soft-check: don't allow deleting customers who have orders unless forced
  db.query(
    'SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ?',
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      const orderCount = rows[0]?.cnt || 0;
      const force      = req.query.force === '1';

      if (orderCount > 0 && !force) {
        return res.status(409).json({
          message: `This customer has ${orderCount} order(s). Add ?force=1 to the request to delete anyway.`,
          order_count: orderCount,
        });
      }

      db.query('DELETE FROM customers WHERE id=?', [req.params.id], (err2, result) => {
        if (err2) {
          console.error('Delete error:', err2);
          return res.status(500).json({ message: 'Database error' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Customer not found' });
        res.json({ message: 'Customer deleted' });
      });
    }
  );
});

module.exports = router;