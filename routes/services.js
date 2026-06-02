// routes/services.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const protect = require('../middleware/auth');

// Ensure upload folder exists
const baseUploadDir = path.join(__dirname, '../uploads/services');
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
  console.log('Created uploads/services folder');
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
  }
});

// ==================== GET ALL SERVICES ====================
router.get('/', async (req, res) => {        // ← Removed 'protect' temporarily (like users)
  try {
    console.log('GET /services route hit - Starting query...');

    const [results] = await db.query(
      'SELECT id, title, slug, description, image1, image2, image3, image4, image5, active, created_at ' +
      'FROM services ORDER BY created_at DESC'
    );

    console.log(`✅ Successfully fetched ${results.length} services`);
    res.json(results);
  } catch (error) {
    console.error('=== GET SERVICES ERROR ===');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('SQL Message:', error.sqlMessage);
    console.error('Full Error:', error);
    
    res.status(500).json({ 
      message: 'Failed to load services', 
      error: error.message 
    });
  }
});

// ==================== GET SINGLE SERVICE ====================
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('SELECT * FROM services WHERE id = ?', [id]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Get single service error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// ==================== CREATE SERVICE ====================
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'image5', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { title, slug, description, active } = req.body;

      const image1 = req.files?.image1 ? req.files.image1[0].filename : null;
      const image2 = req.files?.image2 ? req.files.image2[0].filename : null;
      const image3 = req.files?.image3 ? req.files.image3[0].filename : null;
      const image4 = req.files?.image4 ? req.files.image4[0].filename : null;
      const image5 = req.files?.image5 ? req.files.image5[0].filename : null;

      if (!title || !slug || !description) {
        return res.status(400).json({ message: 'Title, slug, and description are required' });
      }

      const [result] = await db.query(
        'INSERT INTO services (title, slug, description, image1, image2, image3, image4, image5, active) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [title, slug, description, image1, image2, image3, image4, image5, active ? 1 : 0]
      );

      res.status(201).json({ message: 'Service created', id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Slug already exists' });
      }
      console.error('Create service error:', err);
      res.status(500).json({ message: 'Database error' });
    }
  }
);

// ==================== UPDATE SERVICE ====================
router.put(
  '/:id',
  protect,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
    { name: 'image5', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, slug, description, active } = req.body;

      let query = 'UPDATE services SET title = ?, slug = ?, description = ?, active = ?';
      let params = [title, slug, description, active ? 1 : 0];

      if (req.files?.image1) {
        query += ', image1 = ?';
        params.push(req.files.image1[0].filename);
      }
      if (req.files?.image2) {
        query += ', image2 = ?';
        params.push(req.files.image2[0].filename);
      }
      if (req.files?.image3) {
        query += ', image3 = ?';
        params.push(req.files.image3[0].filename);
      }
      if (req.files?.image4) {
        query += ', image4 = ?';
        params.push(req.files.image4[0].filename);
      }
      if (req.files?.image5) {
        query += ', image5 = ?';
        params.push(req.files.image5[0].filename);
      }

      query += ' WHERE id = ?';
      params.push(id);

      const [result] = await db.query(query, params);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Service not found' });
      }

      res.json({ message: 'Service updated successfully' });
    } catch (err) {
      console.error('Update service error:', err);
      res.status(500).json({ message: 'Update failed' });
    }
  }
);

// ==================== DELETE SERVICE ====================
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM services WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// ───────────────────────────────────────────────
// Optional: Additional Images Routes (also converted)
// ───────────────────────────────────────────────

router.post('/:id/images', protect, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, button_text, button_link, order, active } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!image) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const [result] = await db.query(
      'INSERT INTO service_images (service_id, image, title, subtitle, button_text, button_link, `order`, active) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, image, title || null, subtitle || null, button_text || null, button_link || null, order || 0, active ? 1 : 0]
    );

    res.status(201).json({ message: 'Additional image added', id: result.insertId });
  } catch (err) {
    console.error('Additional image insert error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/images/:imageId', protect, async (req, res) => {
  try {
    const { imageId } = req.params;
    const [result] = await db.query('DELETE FROM service_images WHERE id = ?', [imageId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Additional image not found' });
    }

    res.json({ message: 'Additional image deleted successfully' });
  } catch (err) {
    console.error('Additional image delete error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;