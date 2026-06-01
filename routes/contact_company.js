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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only images allowed'));
  }
});

// Company Contact
router.get('/company', protect, (req, res) => {
  db.query(
    'SELECT phone_number, email_address, physical_address, physical_address_link, address_iframe_link FROM company_contact WHERE id = 1',
    (err, results) => {
      if (err) {
        console.error('GET /company DB error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results[0] || {
        phone_number: '',
        email_address: '',
        physical_address: '',
        physical_address_link: '',
        address_iframe_link: ''
      });
    }
  );
});

router.put('/company', protect, (req, res) => {
  const { phone_number, email_address, physical_address, physical_address_link, address_iframe_link } = req.body;

  db.query(
    'UPDATE company_contact SET phone_number = ?, email_address = ?, physical_address = ?, physical_address_link = ?, address_iframe_link = ? WHERE id = 1',
    [phone_number || null, email_address || null, physical_address || null, physical_address_link || null, address_iframe_link || null],
    (err, result) => {
      if (err) {
        console.error('PUT /company UPDATE error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (result.affectedRows === 0) {
        db.query(
          'INSERT INTO company_contact (id, phone_number, email_address, physical_address, physical_address_link, address_iframe_link) VALUES (1, ?, ?, ?, ?, ?)',
          [phone_number || null, email_address || null, physical_address || null, physical_address_link || null, address_iframe_link || null],
          (err2) => {
            if (err2) {
              console.error('PUT /company INSERT error:', err2);
              return res.status(500).json({ message: 'Database error' });
            }
            res.json({ message: 'Company contact created' });
          }
        );
      } else {
        res.json({ message: 'Company contact updated' });
      }
    }
  );
});

// Team Members (unchanged from previous version)
router.get('/team', protect, (req, res) => {
  db.query(
    `SELECT id, name, role, contact_number, photo_url, linkedin_url, twitter_url,
            instagram_url, facebook_url, whatsapp_number, active, \`order\`, created_at
     FROM team_members
     ORDER BY \`order\` ASC, name ASC`,
    (err, results) => {
      if (err) {
        console.error('GET /team error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
    }
  );
});

router.post('/team', protect, upload.single('photo'), (req, res) => {
  const {
    name, role, contact_number, linkedin_url, twitter_url,
    instagram_url, facebook_url, whatsapp_number, active, order
  } = req.body;

  const photo_url = req.file ? req.file.filename : null;

  if (!name || !role) {
    return res.status(400).json({ message: 'Name and role are required' });
  }

  db.query(
    `INSERT INTO team_members
     (name, role, contact_number, photo_url, linkedin_url, twitter_url,
      instagram_url, facebook_url, whatsapp_number, active, \`order\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      role,
      contact_number || null,
      photo_url,
      linkedin_url || null,
      twitter_url || null,
      instagram_url || null,
      facebook_url || null,
      whatsapp_number || null,
      active !== false ? 1 : 0,
      order ? Number(order) : 999
    ],
    (err, result) => {
      if (err) {
        console.error('POST /team error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ message: 'Team member added', id: result.insertId });
    }
  );
});

router.put('/team/:id', protect, upload.single('photo'), (req, res) => {
  const { id } = req.params;
  const {
    name, role, contact_number, linkedin_url, twitter_url,
    instagram_url, facebook_url, whatsapp_number, active, order
  } = req.body;

  let query = 'UPDATE team_members SET ';
  const params = [];
  const updates = [];

  if (name !== undefined)           { updates.push('name = ?');           params.push(name); }
  if (role !== undefined)           { updates.push('role = ?');           params.push(role); }
  if (contact_number !== undefined) { updates.push('contact_number = ?'); params.push(contact_number || null); }
  if (linkedin_url !== undefined)   { updates.push('linkedin_url = ?');   params.push(linkedin_url || null); }
  if (twitter_url !== undefined)    { updates.push('twitter_url = ?');    params.push(twitter_url || null); }
  if (instagram_url !== undefined)  { updates.push('instagram_url = ?');  params.push(instagram_url || null); }
  if (facebook_url !== undefined)   { updates.push('facebook_url = ?');   params.push(facebook_url || null); }
  if (whatsapp_number !== undefined){ updates.push('whatsapp_number = ?');params.push(whatsapp_number || null); }
  if (active !== undefined)         { updates.push('active = ?');         params.push(active ? 1 : 0); }
  if (order !== undefined)          { updates.push('`order` = ?');         params.push(order ? Number(order) : 999); }
  if (req.file)                     { updates.push('photo_url = ?');       params.push(req.file.filename); }

  if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

  query += updates.join(', ');
  query += ' WHERE id = ?';
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('PUT /team/:id error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Team member not found' });
    res.json({ message: 'Team member updated' });
  });
});

router.delete('/team/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM team_members WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('DELETE /team/:id error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Team member deleted' });
  });
});

router.put('/team/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE team_members SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) {
        console.error('PUT /team/:id/toggle-active error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Team member ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

// Public endpoint
router.get('/public', (req, res) => {
  db.query(
    'SELECT phone_number, email_address, physical_address, physical_address_link, address_iframe_link FROM company_contact WHERE id = 1',
    (err, compResults) => {
      if (err) {
        console.error('GET /public company error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      const company = compResults[0] || {
        phone_number: null,
        email_address: null,
        physical_address: null,
        physical_address_link: null,
        address_iframe_link: null
      };

      db.query(
        `SELECT name, role, contact_number, photo_url, linkedin_url, twitter_url,
                instagram_url, facebook_url, whatsapp_number
         FROM team_members
         WHERE active = 1
         ORDER BY \`order\` ASC, name ASC`,
        (err, teamResults) => {
          if (err) {
            console.error('GET /public team error:', err);
            return res.status(500).json({ message: 'Database error' });
          }
          res.json({ company, team: teamResults });
        }
      );
    }
  );
});

module.exports = router;