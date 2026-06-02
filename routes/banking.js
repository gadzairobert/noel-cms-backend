// routes/banking.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

function toBool(val, fallback = 0) {
  if (val === true || val === 1 || val === '1' || val === 'true') return 1;
  if (val === false || val === 0 || val === '0' || val === 'false') return 0;
  return fallback;
}

// ==================== GET ALL BANKING ACCOUNTS ====================
router.get('/', protect, async (req, res) => {
  try {
    console.log('GET /banking route hit');

    const [rows] = await db.query(
      `SELECT id, bank_name, account_name, account_number, branch_code,
              account_type, reference_note, is_active, sort_order, created_at
       FROM store_banking_details
       ORDER BY sort_order ASC, created_at DESC`
    );

    console.log(`✅ Successfully fetched ${rows.length} banking accounts`);
    res.json(rows);
  } catch (error) {
    console.error('=== GET BANKING ACCOUNTS ERROR ===');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('SQL Message:', error.sqlMessage);
    console.error('Full Error:', error);
    
    res.status(500).json({ 
      message: 'Failed to load banking details', 
      error: error.message 
    });
  }
});

// ==================== GET SINGLE BANKING ACCOUNT ====================
router.get('/:id', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, bank_name, account_name, account_number, branch_code,
              account_type, reference_note, is_active, sort_order, created_at
       FROM store_banking_details 
       WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Banking account not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get single banking account error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==================== CREATE BANKING ACCOUNT ====================
router.post('/', protect, async (req, res) => {
  try {
    const { bank_name, account_name, account_number, branch_code,
            account_type, reference_note, is_active, sort_order } = req.body;

    if (!account_name || !bank_name || !account_number || !branch_code) {
      return res.status(400).json({
        message: 'Account name, bank name, account number and branch code are required',
      });
    }

    const [result] = await db.query(
      `INSERT INTO store_banking_details
         (bank_name, account_name, account_number, branch_code, account_type,
          reference_note, is_active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        bank_name,
        account_name,
        account_number,
        branch_code,
        account_type || null,
        reference_note || null,
        toBool(is_active, 1),
        sort_order != null ? parseInt(sort_order, 10) : 0,
      ]
    );

    res.status(201).json({ 
      message: 'Banking account created successfully', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Create banking account error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==================== UPDATE BANKING ACCOUNT ====================
router.put('/:id', protect, async (req, res) => {
  try {
    const { bank_name, account_name, account_number, branch_code,
            account_type, reference_note, is_active, sort_order } = req.body;

    if (!account_name || !bank_name || !account_number || !branch_code) {
      return res.status(400).json({
        message: 'Account name, bank name, account number and branch code are required',
      });
    }

    const [result] = await db.query(
      `UPDATE store_banking_details SET
         bank_name=?, account_name=?, account_number=?, branch_code=?,
         account_type=?, reference_note=?, is_active=?, sort_order=?
       WHERE id=?`,
      [
        bank_name,
        account_name,
        account_number,
        branch_code,
        account_type || null,
        reference_note || null,
        toBool(is_active, 1),
        sort_order != null ? parseInt(sort_order, 10) : 0,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Banking account not found' });
    }

    res.json({ message: 'Banking account updated successfully' });
  } catch (error) {
    console.error('Update banking account error:', error);
    res.status(500).json({ message: 'Update failed' });
  }
});

// ==================== TOGGLE ACTIVE STATUS ====================
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { is_active } = req.body;

    const [result] = await db.query(
      'UPDATE store_banking_details SET is_active = ? WHERE id = ?',
      [toBool(is_active, 0), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Banking account not found' });
    }

    res.json({ message: 'Account status updated successfully' });
  } catch (error) {
    console.error('Toggle banking active status error:', error);
    res.status(500).json({ message: 'Update failed' });
  }
});

// ==================== DELETE BANKING ACCOUNT ====================
router.delete('/:id', protect, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM store_banking_details WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Banking account not found' });
    }

    res.json({ message: 'Banking account deleted successfully' });
  } catch (error) {
    console.error('Delete banking account error:', error);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;