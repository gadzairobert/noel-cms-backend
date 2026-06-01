// routes/videos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure thumbnails folder exists
const uploadDir = path.join(__dirname, '../uploads/thumbnails');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpe?g|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// GET all videos (admin)
router.get('/', protect, (req, res) => {
  db.query(
    `SELECT id, title, description, video_url, thumbnail_filename, show_on_pages, active, \`order\`, created_at
     FROM videos
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// GET active videos (public / frontend)
router.get('/active', (req, res) => {
  db.query(
    `SELECT id, title, description, video_url, thumbnail_filename, \`order\`
     FROM videos
     WHERE active = 1
     ORDER BY \`order\` ASC, id DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
});

// POST new video
router.post('/', protect, upload.single('thumbnail'), (req, res) => {
  const { title, description, video_url, show_on_pages, order, active } = req.body;
  const thumbnail = req.file ? req.file.filename : null;

  if (!title || !video_url) {
    return res.status(400).json({ message: 'Title and YouTube URL are required' });
  }

  if (!video_url.includes('youtube.com') && !video_url.includes('youtu.be')) {
    return res.status(400).json({ message: 'Please provide a valid YouTube URL' });
  }

  db.query(
    `INSERT INTO videos 
     (title, description, video_url, thumbnail_filename, show_on_pages, \`order\`, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description || null,
      video_url,
      thumbnail,
      show_on_pages || null,
      order ? Number(order) : 999,
      active !== false ? 1 : 0
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(201).json({ message: 'Video added', id: result.insertId });
    }
  );
});

// PUT update
router.put('/:id', protect, upload.single('thumbnail'), (req, res) => {
  const { id } = req.params;
  const { title, description, video_url, show_on_pages, order, active } = req.body;

  let query = `UPDATE videos SET title = ?`;
  const params = [title];

  if (description !== undefined)    { query += `, description = ?`;    params.push(description || null); }
  if (video_url !== undefined)      { query += `, video_url = ?`;      params.push(video_url); }
  if (req.file)                     { query += `, thumbnail_filename = ?`; params.push(req.file.filename); }
  if (show_on_pages !== undefined)  { query += `, show_on_pages = ?`;  params.push(show_on_pages || null); }
  if (order !== undefined)          { query += `, \`order\` = ?`;      params.push(Number(order)); }
  if (active !== undefined)         { query += `, active = ?`;         params.push(active ? 1 : 0); }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Video updated' });
  });
});

// DELETE
router.delete('/:id', protect, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM videos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Delete failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Video deleted' });
  });
});

// Toggle active
router.put('/:id/toggle-active', protect, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.query(
    'UPDATE videos SET active = ? WHERE id = ?',
    [active ? 1 : 0, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Update failed' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ message: `Video ${active ? 'activated' : 'deactivated'}` });
    }
  );
});

module.exports = router;