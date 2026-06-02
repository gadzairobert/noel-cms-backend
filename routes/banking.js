// routes/banking.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/auth');

function toBool(val, fallback = 0) {
  if (val === true  || val === 1  || val === '1'  || val === 'true')  return 1;
  if (val === false || val === 0  || val === '0'  || val === 'false') return 0;
  return fallback;
}

// ════════════════════════════════════════════════════════════
// GET /api/banking  — list all
// ════════════════════════════════════════════════════════════
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, bank_name, account_name, account_number, branch_code,
            account_type, reference_note, is_active, sort_order, created_at
     FROM store_banking_details
     ORDER BY sort_order ASC, created_at DESC`,
    (err, rows) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      res.json(rows);
    }
  );
});

// ════════════════════════════════════════════════════════════
// GET /api/banking/:id  — single record
// ════════════════════════════════════════════════════════════
router.get('/:id', protect, (req, res) => {
  db.query(
    `SELECT id, bank_name, account_name, account_number, branch_code,
            account_type, reference_note, is_active, sort_order, created_at
     FROM store_banking_details WHERE id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (!rows.length) return res.status(404).json({ message: 'Banking account not found' });
      res.json(rows[0]);
    }
  );
});

// ════════════════════════════════════════════════════════════
// POST /api/banking  — create
// ════════════════════════════════════════════════════════════
router.post('/', protect, (req, res) => {
  const { bank_name, account_name, account_number, branch_code,
          account_type, reference_note, is_active, sort_order } = req.body;

  if (!account_name || !bank_name || !account_number || !branch_code) {
    return res.status(400).json({
      message: 'Account name, bank name, account number and branch code are required',
    });
  }

  db.query(
    `INSERT INTO store_banking_details
       (bank_name, account_name, account_number, branch_code, account_type,
        reference_note, is_active, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      bank_name,
      account_name,
      account_number,
      branch_code,
      account_type   || null,
      reference_note || null,
      toBool(is_active, 1),
      sort_order != null ? parseInt(sort_order, 10) : 0,
    ],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      res.status(201).json({ message: 'Banking account created', id: result.insertId });
    }
  );
});

// ════════════════════════════════════════════════════════════
// PUT /api/banking/:id  — update
// ════════════════════════════════════════════════════════════
router.put('/:id', protect, (req, res) => {
  const { bank_name, account_name, account_number, branch_code,
          account_type, reference_note, is_active, sort_order } = req.body;

  if (!account_name || !bank_name || !account_number || !branch_code) {
    return res.status(400).json({
      message: 'Account name, bank name, account number and branch code are required',
    });
  }

  db.query(
    `UPDATE store_banking_details SET
       bank_name=?, account_name=?, account_number=?, branch_code=?,
       account_type=?, reference_note=?, is_active=?, sort_order=?
     WHERE id=?`,
    [
      bank_name,
      account_name,
      account_number,
      branch_code,
      account_type   || null,
      reference_note || null,
      toBool(is_active, 1),
      sort_order != null ? parseInt(sort_order, 10) : 0,
      req.params.id,
    ],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Banking account not found' });
      res.json({ message: 'Banking account updated' });
    }
  );
});

// ════════════════════════════════════════════════════════════
// PUT /api/banking/:id/toggle-active  — activate / deactivate
// ════════════════════════════════════════════════════════════
router.put('/:id/toggle-active', protect, (req, res) => {
  const { is_active } = req.body;
  db.query(
    'UPDATE store_banking_details SET is_active=? WHERE id=?',
    [toBool(is_active, 0), req.params.id],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Banking account not found' });
      res.json({ message: 'Account status updated' });
    }
  );
});

// ════════════════════════════════════════════════════════════
// DELETE /api/banking/:id
// ════════════════════════════════════════════════════════════
router.delete('/:id', protect, (req, res) => {
  db.query(
    'DELETE FROM store_banking_details WHERE id = ?',
    [req.params.id],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Banking account not found' });
      res.json({ message: 'Banking account deleted' });
    }
  );
});

module.exports = router;