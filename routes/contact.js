// routes/contact.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/auth');

// GET all messages (admin only) - with optional status filter
router.get('/', protect, async (req, res) => {
  const { status } = req.query;
  let query = `SELECT id, name, email, phone, subject, message, status, created_at, updated_at, replied_at
               FROM contact_messages`;
  const params = [];

  if (status && ['new','read','replied','resolved','spam'].includes(status)) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(query, params);
    connection.release();
    connection = null;
    res.json(results);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /contact error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET single message
router.get('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT * FROM contact_messages WHERE id = ?',
      [req.params.id]
    );
    connection.release();
    connection = null;
    if (results.length === 0) return res.status(404).json({ message: 'Message not found' });
    res.json(results[0]);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /contact/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT - change status
router.put('/:id/status', protect, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['new','read','replied','resolved','spam'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const extra = status === 'replied' ? ', replied_at = NOW()' : '';

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      `UPDATE contact_messages SET status = ? ${extra} WHERE id = ?`,
      [status, id]
    );
    connection.release();
    connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /contact/:id/status error:', err.code, err.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT - add reply
router.put('/:id/reply', protect, async (req, res) => {
  const { id } = req.params;
  const { reply_message } = req.body;

  if (!reply_message?.trim()) {
    return res.status(400).json({ message: 'Reply message required' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      `UPDATE contact_messages SET reply_message = ?, replied_at = NOW(), status = 'replied' WHERE id = ?`,
      [reply_message, id]
    );
    connection.release();
    connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Reply saved' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /contact/:id/reply error:', err.code, err.message);
    res.status(500).json({ message: 'Failed to save reply' });
  }
});

// DELETE message
router.delete('/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'DELETE FROM contact_messages WHERE id = ?',
      [req.params.id]
    );
    connection.release();
    connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('DELETE /contact/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;