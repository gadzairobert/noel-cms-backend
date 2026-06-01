// routes/contact.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all messages (admin only) - with optional status filter
router.get('/', protect, (req, res) => {
  const { status } = req.query;
  let query = `SELECT id, name, email, phone, subject, message, status, created_at, updated_at, replied_at
               FROM contact_messages`;
  const params = [];

  if (status && ['new','read','replied','resolved','spam'].includes(status)) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(results);
  });
});

// GET single message details
router.get('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query(
    `SELECT * FROM contact_messages WHERE id = ?`,
    [id],
    (err, results) => {
      if (err || results.length === 0) return res.status(404).json({ message: 'Message not found' });
      res.json(results[0]);
    }
  );
});

// PUT - mark as read / change status
router.put('/:id/status', protect, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['new','read','replied','resolved','spam'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const extra = status === 'replied' ? ', replied_at = NOW()' : '';

  db.query(
    `UPDATE contact_messages SET status = ? ${extra} WHERE id = ?`,
    [status, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found' });
      res.json({ message: `Status updated to ${status}` });
    }
  );
});

// PUT - add admin reply (optional feature)
router.put('/:id/reply', protect, (req, res) => {
  const { id } = req.params;
  const { reply_message } = req.body;

  if (!reply_message?.trim()) {
    return res.status(400).json({ message: 'Reply message required' });
  }

  db.query(
    `UPDATE contact_messages 
     SET reply_message = ?, replied_at = NOW(), status = 'replied'
     WHERE id = ?`,
    [reply_message, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to save reply' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found' });
      res.json({ message: 'Reply saved' });
    }
  );
});

// DELETE message (permanent)
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM contact_messages WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Message deleted' });
  });
});

module.exports = router;