// routes/contact_company.js
const express = require('express');
const router = express.Router();

console.log("------------------------------------------------");
console.log("contact_company.js → FILE HAS BEEN REQUIRED");
console.log("Mounted under: /api/contact_company");
console.log("------------------------------------------------");

const db = require('../config/db');
const protect = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload folder exists
const baseUploadDir = path.join(__dirname, '../uploads/company');
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, baseUploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only images allowed'));
  }
});

// ==================== COMPANY CONTACT ====================

router.get('/company', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT phone_number, email_address, physical_address, physical_address_link, address_iframe_link FROM company_contact WHERE id = 1'
    );
    connection.release();
    connection = null;
    res.json(results[0] || {
      phone_number: '', email_address: '', physical_address: '',
      physical_address_link: '', address_iframe_link: ''
    });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /company error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/company', protect, async (req, res) => {
  const { phone_number, email_address, physical_address, physical_address_link, address_iframe_link } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'UPDATE company_contact SET phone_number = ?, email_address = ?, physical_address = ?, physical_address_link = ?, address_iframe_link = ? WHERE id = 1',
      [phone_number || null, email_address || null, physical_address || null, physical_address_link || null, address_iframe_link || null]
    );

    if (result.affectedRows === 0) {
      await connection.execute(
        'INSERT INTO company_contact (id, phone_number, email_address, physical_address, physical_address_link, address_iframe_link) VALUES (1, ?, ?, ?, ?, ?)',
        [phone_number || null, email_address || null, physical_address || null, physical_address_link || null, address_iframe_link || null]
      );
      connection.release();
      connection = null;
      return res.json({ message: 'Company contact created' });
    }

    connection.release();
    connection = null;
    res.json({ message: 'Company contact updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /company error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==================== TEAM MEMBERS ====================

router.get('/team', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [results] = await connection.execute(
      'SELECT id, name, role, contact_number, photo_url, linkedin_url, twitter_url, instagram_url, facebook_url, whatsapp_number, active, `order`, created_at FROM team_members ORDER BY `order` ASC, name ASC'
    );
    connection.release();
    connection = null;
    res.json(results);
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /team error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/team', protect, upload.single('photo'), async (req, res) => {
  const { name, role, contact_number, linkedin_url, twitter_url, instagram_url, facebook_url, whatsapp_number, active, order } = req.body;
  const photo_url = req.file ? req.file.filename : null;

  if (!name || !role) return res.status(400).json({ message: 'Name and role are required' });

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO team_members (name, role, contact_number, photo_url, linkedin_url, twitter_url, instagram_url, facebook_url, whatsapp_number, active, `order`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, role, contact_number || null, photo_url, linkedin_url || null, twitter_url || null, instagram_url || null, facebook_url || null, whatsapp_number || null, active !== false ? 1 : 0, order ? Number(order) : 999]
    );
    connection.release();
    connection = null;
    res.status(201).json({ message: 'Team member added', id: result.insertId });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('POST /team error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/team/:id', protect, upload.single('photo'), async (req, res) => {
  const { id } = req.params;
  const { name, role, contact_number, linkedin_url, twitter_url, instagram_url, facebook_url, whatsapp_number, active, order } = req.body;

  const updates = [];
  const params = [];

  if (name !== undefined)            { updates.push('name = ?');            params.push(name); }
  if (role !== undefined)            { updates.push('role = ?');            params.push(role); }
  if (contact_number !== undefined)  { updates.push('contact_number = ?');  params.push(contact_number || null); }
  if (linkedin_url !== undefined)    { updates.push('linkedin_url = ?');    params.push(linkedin_url || null); }
  if (twitter_url !== undefined)     { updates.push('twitter_url = ?');     params.push(twitter_url || null); }
  if (instagram_url !== undefined)   { updates.push('instagram_url = ?');   params.push(instagram_url || null); }
  if (facebook_url !== undefined)    { updates.push('facebook_url = ?');    params.push(facebook_url || null); }
  if (whatsapp_number !== undefined) { updates.push('whatsapp_number = ?'); params.push(whatsapp_number || null); }
  if (active !== undefined)          { updates.push('active = ?');          params.push(active ? 1 : 0); }
  if (order !== undefined)           { updates.push('`order` = ?');         params.push(order ? Number(order) : 999); }
  if (req.file)                      { updates.push('photo_url = ?');       params.push(req.file.filename); }

  if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

  params.push(id);

  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      `UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    connection.release();
    connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Team member not found' });
    res.json({ message: 'Team member updated' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /team/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/team/:id', protect, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'DELETE FROM team_members WHERE id = ?',
      [req.params.id]
    );
    connection.release();
    connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Team member deleted' });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('DELETE /team/:id error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/team/:id/toggle-active', protect, async (req, res) => {
  const { active } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    const [result] = await connection.execute(
      'UPDATE team_members SET active = ? WHERE id = ?',
      [active ? 1 : 0, req.params.id]
    );
    connection.release();
    connection = null;
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Team member ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('PUT /team/:id/toggle-active error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==================== PUBLIC ====================

router.get('/public', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [compResults] = await connection.execute(
      'SELECT phone_number, email_address, physical_address, physical_address_link, address_iframe_link FROM company_contact WHERE id = 1'
    );
    const [teamResults] = await connection.execute(
      'SELECT name, role, contact_number, photo_url, linkedin_url, twitter_url, instagram_url, facebook_url, whatsapp_number FROM team_members WHERE active = 1 ORDER BY `order` ASC, name ASC'
    );
    connection.release();
    connection = null;
    res.json({
      company: compResults[0] || { phone_number: null, email_address: null, physical_address: null, physical_address_link: null, address_iframe_link: null },
      team: teamResults
    });
  } catch (err) {
    if (connection) { connection.release(); connection = null; }
    console.error('GET /public error:', err.code, err.message);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;