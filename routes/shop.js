// routes/shop.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/db');
const protect = require('../middleware/auth');

const shopUploadDir = path.join(__dirname, '../uploads/shop');
if (!fs.existsSync(shopUploadDir)) fs.mkdirSync(shopUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, shopUploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())
            && /jpeg|jpg|png|gif|webp/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
});

const productImages = upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
]);

function removeFile(filename) {
  if (!filename) return;
  fs.unlink(path.join(shopUploadDir, filename), () => {});
}
function toBool(val, fallback = 0) {
  if (val === true  || val === 1  || val === '1'  || val === 'true')  return 1;
  if (val === false || val === 0  || val === '0'  || val === 'false') return 0;
  return fallback;
}
function toDecimal(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}
function toInt(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

// ════════════════════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════════════════════
router.get('/categories', protect, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM product_categories ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/categories', protect, async (req, res) => {
  try {
    const { name, slug, description, active } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Name and slug are required' });
    const [result] = await db.query(
      'INSERT INTO product_categories (name, slug, description, active) VALUES (?,?,?,?)',
      [name, slug, description || '', toBool(active, 1)]
    );
    res.status(201).json({ id: result.insertId, message: 'Category created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Slug already exists' });
    console.error('Create category error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/categories/:id', protect, async (req, res) => {
  try {
    const { name, slug, description, active } = req.body;
    const [result] = await db.query(
      'UPDATE product_categories SET name=?, slug=?, description=?, active=? WHERE id=?',
      [name, slug, description || '', toBool(active, 1), req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category updated' });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/categories/:id', protect, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM product_categories WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════
router.get('/products', protect, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.name AS category_name
      FROM   shop_products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ORDER  BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get shop products error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.get('/products/:id', protect, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.name AS category_name
      FROM   shop_products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE  p.id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Get shop product error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/products', protect, productImages, async (req, res) => {
  try {
    const {
      category_id, name, slug, description,
      price, sale_price, discount_percent,
      sku, quantity, low_stock_alert,
      weight, dimensions, is_featured, active,
      car_make, car_model, car_year_from, car_year_to, car_variant,
      engine_size, fuel_type, transmission, drive_type,
      part_number, oem_number, condition_type, placement, compatibility_notes,
    } = req.body;

    if (!name || !slug)            return res.status(400).json({ message: 'Name and slug are required' });
    if (toDecimal(price) === null) return res.status(400).json({ message: 'A valid price is required' });

    const image1 = req.files?.image1?.[0]?.filename || null;
    const image2 = req.files?.image2?.[0]?.filename || null;
    const image3 = req.files?.image3?.[0]?.filename || null;
    const catId  = category_id && category_id !== '' ? parseInt(category_id, 10) : null;

    const [result] = await db.query(`
      INSERT INTO shop_products
        (category_id, name, slug, description, price, sale_price, discount_percent,
         sku, quantity, low_stock_alert, image1, image2, image3,
         weight, dimensions, is_featured, active,
         car_make, car_model, car_year_from, car_year_to, car_variant,
         engine_size, fuel_type, transmission, drive_type,
         part_number, oem_number, condition_type, placement, compatibility_notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      catId, name, slug, description || '',
      toDecimal(price) ?? 0, toDecimal(sale_price), toDecimal(discount_percent) ?? 0,
      sku || null, toInt(quantity) ?? 0, toInt(low_stock_alert) ?? 5,
      image1, image2, image3,
      toDecimal(weight), dimensions || null, toBool(is_featured, 0), toBool(active, 1),
      car_make || null, car_model || null, toInt(car_year_from), toInt(car_year_to),
      car_variant || null, engine_size || null, fuel_type || null, transmission || null,
      drive_type || null, part_number || null, oem_number || null,
      condition_type || null, placement || null, compatibility_notes || null,
    ]);
    res.status(201).json({ id: result.insertId, message: 'Product created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Slug already exists' });
    console.error('Create shop product error:', err);
    res.status(500).json({ message: 'Database error', detail: err.message });
  }
});

router.put('/products/:id', protect, productImages, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query('SELECT * FROM shop_products WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });

    const existing = rows[0];
    const {
      category_id, name, slug, description,
      price, sale_price, discount_percent,
      sku, quantity, low_stock_alert,
      weight, dimensions, is_featured, active,
      car_make, car_model, car_year_from, car_year_to, car_variant,
      engine_size, fuel_type, transmission, drive_type,
      part_number, oem_number, condition_type, placement, compatibility_notes,
    } = req.body;

    const image1 = req.files?.image1?.[0]?.filename || null;
    const image2 = req.files?.image2?.[0]?.filename || null;
    const image3 = req.files?.image3?.[0]?.filename || null;

    if (image1 && existing.image1) removeFile(existing.image1);
    if (image2 && existing.image2) removeFile(existing.image2);
    if (image3 && existing.image3) removeFile(existing.image3);

    const catId = category_id && category_id !== '' ? parseInt(category_id, 10) : null;

    const [result] = await db.query(`
      UPDATE shop_products SET
        category_id=?, name=?, slug=?, description=?,
        price=?, sale_price=?, discount_percent=?,
        sku=?, quantity=?, low_stock_alert=?,
        image1 = COALESCE(?, image1),
        image2 = COALESCE(?, image2),
        image3 = COALESCE(?, image3),
        weight=?, dimensions=?, is_featured=?, active=?,
        car_make=?, car_model=?, car_year_from=?, car_year_to=?, car_variant=?,
        engine_size=?, fuel_type=?, transmission=?, drive_type=?,
        part_number=?, oem_number=?, condition_type=?, placement=?, compatibility_notes=?
      WHERE id=?
    `, [
      catId, name, slug, description || '',
      toDecimal(price) ?? 0, toDecimal(sale_price), toDecimal(discount_percent) ?? 0,
      sku || null, toInt(quantity) ?? 0, toInt(low_stock_alert) ?? 5,
      image1, image2, image3,
      toDecimal(weight), dimensions || null, toBool(is_featured, 0), toBool(active, 1),
      car_make || null, car_model || null, toInt(car_year_from), toInt(car_year_to),
      car_variant || null, engine_size || null, fuel_type || null, transmission || null,
      drive_type || null, part_number || null, oem_number || null,
      condition_type || null, placement || null, compatibility_notes || null,
      id,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Slug already exists' });
    console.error('Update shop product error:', err);
    res.status(500).json({ message: 'Database error', detail: err.message });
  }
});

router.put('/products/:id/toggle-active', protect, async (req, res) => {
  try {
    const { active } = req.body;
    const [result] = await db.query(
      'UPDATE shop_products SET active=? WHERE id=?',
      [toBool(active, 0), req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('Toggle shop product error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/products/:id', protect, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM shop_products WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });

    const p = rows[0];
    removeFile(p.image1); removeFile(p.image2); removeFile(p.image3);

    const [result] = await db.query('DELETE FROM shop_products WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete shop product error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ════════════════════════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════════════════════════
router.get('/orders', protect, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.get('/orders/:id', protect, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ message: 'Order not found' });
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    res.json({ ...orders[0], items });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/orders', protect, async (req, res) => {
  try {
    const {
      customer_name, customer_email, customer_phone,
      shipping_address, subtotal, discount_amount,
      shipping_cost, total, payment_method, notes,
      coupon_code, items = [],
    } = req.body;

    if (!customer_name || !customer_email || !items.length) {
      return res.status(400).json({ message: 'customer_name, customer_email and items are required' });
    }

    const now         = new Date();
    const datePart    = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart    = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `ORD-${datePart}-${randPart}`;

    const [orderResult] = await db.query(
      `INSERT INTO orders
         (order_number, customer_name, customer_email, customer_phone,
          shipping_address, subtotal, discount_amount, shipping_cost, total,
          status, payment_status, payment_method, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        orderNumber,
        customer_name, customer_email, customer_phone || null,
        shipping_address || null,
        toDecimal(subtotal) ?? 0, toDecimal(discount_amount) ?? 0,
        toDecimal(shipping_cost) ?? 0, toDecimal(total) ?? 0,
        'pending', 'unpaid', payment_method || null, notes || null,
      ]
    );

    const orderId = orderResult.insertId;
    const itemValues = items.map(item => [
      orderId,
      item.product_id   || null,
      item.product_name || 'Unknown',
      item.sku          || null,
      toInt(item.quantity)        ?? 1,
      toDecimal(item.unit_price)  ?? 0,
      toDecimal(item.total_price) ?? 0,
    ]);

    await db.query(
      'INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price) VALUES ?',
      [itemValues]
    );

    if (coupon_code) {
      db.query('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [coupon_code.toUpperCase()])
        .catch(err => console.error('Coupon update error:', err));
    }

    res.status(201).json({ id: orderId, order_number: orderNumber, message: 'Order created' });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/orders/:id/status', protect, async (req, res) => {
  try {
    const { status, payment_status } = req.body;
    const [result] = await db.query(
      'UPDATE orders SET status=?, payment_status=? WHERE id=?',
      [status, payment_status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order status updated' });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/orders/:id', protect, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

// ════════════════════════════════════════════════════════════
// COUPONS
// ════════════════════════════════════════════════════════════
router.get('/coupons', protect, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Get coupons error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/coupons/validate', async (req, res) => {
  try {
    const { code, order_value } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const [rows] = await db.query('SELECT * FROM coupons WHERE code=? AND active=1', [code.toUpperCase()]);
    if (!rows.length) return res.status(404).json({ message: 'Invalid or inactive coupon' });

    const coupon = rows[0];
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
      return res.status(400).json({ message: 'Coupon has expired' });
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    if (coupon.min_order_value > 0 && parseFloat(order_value) < coupon.min_order_value)
      return res.status(400).json({ message: `Minimum order value of R${parseFloat(coupon.min_order_value).toFixed(2)} required` });

    res.json({ valid: true, coupon });
  } catch (err) {
    console.error('Validate coupon error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/coupons', protect, async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order_value, max_uses, expires_at, active } = req.body;
    if (!code || !discount_value) return res.status(400).json({ message: 'Code and discount value are required' });

    const [result] = await db.query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_uses, expires_at, active)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        code.toUpperCase(), description || '', discount_type || 'percent',
        toDecimal(discount_value) ?? 0, toDecimal(min_order_value) ?? 0,
        toInt(max_uses), expires_at || null, toBool(active, 1)
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Coupon created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Coupon code already exists' });
    console.error('Create coupon error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/coupons/:id', protect, async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_order_value, max_uses, expires_at, active } = req.body;
    const [result] = await db.query(
      `UPDATE coupons SET code=?, description=?, discount_type=?, discount_value=?,
       min_order_value=?, max_uses=?, expires_at=?, active=? WHERE id=?`,
      [
        code?.toUpperCase(), description || '', discount_type || 'percent',
        toDecimal(discount_value) ?? 0, toDecimal(min_order_value) ?? 0,
        toInt(max_uses), expires_at || null, toBool(active, 1), req.params.id
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon updated' });
  } catch (err) {
    console.error('Update coupon error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/coupons/:id', protect, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM coupons WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    console.error('Delete coupon error:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;