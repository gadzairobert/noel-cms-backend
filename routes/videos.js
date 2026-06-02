// routes/videos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /jpe?g|png|webp/.test(path.extname(file.originalname).toLowerCase()));
  }
});

// GET all videos (admin)
router.get('/', protect, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, title, description, video_url, thumbnail_filename, show_on_pages, active, \`order\`, created_at
       FROM videos
       ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get videos error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// GET active videos (public / frontend)
router.get('/active', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT id, title, description, video_url, thumbnail_filename, \`order\`
       FROM videos
       WHERE active = 1
       ORDER BY \`order\` ASC, id DESC`
    );
    res.json(results);
  } catch (err) {
    console.error('Get active videos error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// POST new video
router.post('/', protect, upload.single('thumbnail'), async (req, res) => {
  try {
    const { title, description, video_url, show_on_pages, order, active } = req.body;
    const thumbnail = req.file ? req.file.filename : null;

    if (!title || !video_url) {
      return res.status(400).json({ message: 'Title and YouTube URL are required' });
    }
    if (!video_url.includes('youtube.com') && !video_url.includes('youtu.be')) {
      return res.status(400).json({ message: 'Please provide a valid YouTube URL' });
    }

    const [result] = await db.query(
      `INSERT INTO videos 
       (title, description, video_url, thumbnail_filename, show_on_pages, \`order\`, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title, description || null, video_url, thumbnail,
        show_on_pages || null,
        order ? Number(order) : 999,
        active !== false ? 1 : 0
      ]
    );
    res.status(201).json({ message: 'Video added', id: result.insertId });
  } catch (err) {
    console.error('Create video error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// PUT update
router.put('/:id', protect, upload.single('thumbnail'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, video_url, show_on_pages, order, active } = req.body;

    let query = `UPDATE videos SET title = ?`;
    const params = [title];

    if (description !== undefined)   { query += `, description = ?`;        params.push(description || null); }
    if (video_url !== undefined)     { query += `, video_url = ?`;          params.push(video_url); }
    if (req.file)                    { query += `, thumbnail_filename = ?`; params.push(req.file.filename); }
    if (show_on_pages !== undefined) { query += `, show_on_pages = ?`;      params.push(show_on_pages || null); }
    if (order !== undefined)         { query += `, \`order\` = ?`;          params.push(Number(order)); }
    if (active !== undefined)        { query += `, active = ?`;             params.push(active ? 1 : 0); }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Video updated' });
  } catch (err) {
    console.error('Update video error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM videos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Video deleted' });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Toggle active
router.put('/:id/toggle-active', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE videos SET active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Not found' });
    res.json({ message: `Video ${active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('Toggle video error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;