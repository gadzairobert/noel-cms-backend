const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Upload setup
const uploadDir = path.join(__dirname, '../uploads/about');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `hero-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpe?g|png|webp/i.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP allowed'), false);
    }
  }
});

// GET single record (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, title, hero_image, content, mission_statement, vision,
            objectives, core_values, meta_description, active, updated_at
     FROM about_us
     LIMIT 1`,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!results.length) {
        return res.json(null); // ← important: return null when no record
      }

      const row = results[0];
      res.json({
        ...row,
        active: !!row.active
      });
    }
  );
});

// GET public version
router.get('/public', (req, res) => {
  db.query(
    `SELECT title, hero_image, content, mission_statement, vision,
            objectives, core_values, meta_description
     FROM about_us
     WHERE active = 1
     LIMIT 1`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (!results.length) return res.json({});
      res.json(results[0]);
    }
  );
});

// CREATE
router.post('/', protect, upload.single('hero_image'), (req, res) => {
  const {
    title = 'About Us',
    content = '',
    mission_statement = '',
    vision = '',
    objectives = '',
    core_values = '',
    meta_description = '',
    active = '1'
  } = req.body;

  const hero_image = req.file?.filename ?? null;

  db.query(
    `INSERT INTO about_us
     (title, content, mission_statement, vision, objectives, core_values,
      hero_image, meta_description, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      title,
      content,
      mission_statement,
      vision,
      objectives,
      core_values,
      hero_image,
      meta_description || null,
      Number(active) ? 1 : 0
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to create record' });
      }
      res.status(201).json({ message: 'Created', id: result.insertId });
    }
  );
});

// UPDATE
router.put('/:id', protect, upload.single('hero_image'), (req, res) => {
  const { id } = req.params;
  const {
    title = 'About Us',
    content = '',
    mission_statement,
    vision,
    objectives,
    core_values,
    meta_description,
    active
  } = req.body;

  let sql = 'UPDATE about_us SET title = ?, content = ?, updated_at = NOW()';
  const values = [title, content];

  if (mission_statement !== undefined) {
    sql += ', mission_statement = ?';
    values.push(mission_statement);
  }
  if (vision !== undefined) {
    sql += ', vision = ?';
    values.push(vision);
  }
  if (objectives !== undefined) {
    sql += ', objectives = ?';
    values.push(objectives);
  }
  if (core_values !== undefined) {
    sql += ', core_values = ?';
    values.push(core_values);
  }
  if (req.file) {
    sql += ', hero_image = ?';
    values.push(req.file.filename);
  }
  if (meta_description !== undefined) {
    sql += ', meta_description = ?';
    values.push(meta_description || null);
  }
  if (active !== undefined) {
    sql += ', active = ?';
    values.push(Number(active) ? 1 : 0);
  }

  sql += ' WHERE id = ?';
  values.push(id);

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Update failed' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json({ message: 'Updated successfully' });
  });
});

module.exports = router;