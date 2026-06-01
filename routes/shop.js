// routes/shop.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/db');
const protect = require('../middleware/auth');

// ════════════════════════════════════════════════════════════
// Multer – product images
// ════════════════════════════════════════════════════════════
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
router.get('/categories', protect, (req, res) => {
  db.query('SELECT * FROM product_categories ORDER BY name ASC', (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    res.json(rows);
  });
});

router.post('/categories', protect, (req, res) => {
  const { name, slug, description, active } = req.body;
  if (!name || !slug) return res.status(400).json({ message: 'Name and slug are required' });
  db.query(
    'INSERT INTO product_categories (name, slug, description, active) VALUES (?,?,?,?)',
    [name, slug, description || '', toBool(active, 1)],
    (err, result) => {
      if (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Slug already exists' });
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: result.insertId, message: 'Category created' });
    }
  );
});

router.put('/categories/:id', protect, (req, res) => {
  const { name, slug, description, active } = req.body;
  db.query(
    'UPDATE product_categories SET name=?, slug=?, description=?, active=? WHERE id=?',
    [name, slug, description || '', toBool(active, 1), req.params.id],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Category not found' });
      res.json({ message: 'Category updated' });
    }
  );
});

router.delete('/categories/:id', protect, (req, res) => {
  db.query('DELETE FROM product_categories WHERE id=?', [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  });
});

// ════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════
router.get('/products', protect, (req, res) => {
  const sql = `
    SELECT p.*, c.name AS category_name
    FROM   shop_products p
    LEFT JOIN product_categories c ON p.category_id = c.id
    ORDER  BY p.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    res.json(rows);
  });
});

router.get('/products/:id', protect, (req, res) => {
  const sql = `
    SELECT p.*, c.name AS category_name
    FROM   shop_products p
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE  p.id = ?
  `;
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  });
});

router.post('/products', protect, productImages, (req, res) => {
  const {
    category_id, name, slug, description,
    price, sale_price, discount_percent,
    sku, quantity, low_stock_alert,
    weight, dimensions, is_featured, active,
    // car-specific
    car_make, car_model, car_year_from, car_year_to, car_variant,
    engine_size, fuel_type, transmission, drive_type,
    part_number, oem_number, condition_type, placement, compatibility_notes,
  } = req.body;

  if (!name || !slug)               return res.status(400).json({ message: 'Name and slug are required' });
  if (toDecimal(price) === null)    return res.status(400).json({ message: 'A valid price is required' });

  const image1 = req.files?.image1?.[0]?.filename || null;
  const image2 = req.files?.image2?.[0]?.filename || null;
  const image3 = req.files?.image3?.[0]?.filename || null;
  const catId  = category_id && category_id !== '' ? parseInt(category_id, 10) : null;

  const sql = `
    INSERT INTO shop_products
      (category_id, name, slug, description, price, sale_price, discount_percent,
       sku, quantity, low_stock_alert, image1, image2, image3,
       weight, dimensions, is_featured, active,
       car_make, car_model, car_year_from, car_year_to, car_variant,
       engine_size, fuel_type, transmission, drive_type,
       part_number, oem_number, condition_type, placement, compatibility_notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  const values = [
    catId, name, slug, description || '',
    toDecimal(price) ?? 0,
    toDecimal(sale_price),
    toDecimal(discount_percent) ?? 0,
    sku || null,
    toInt(quantity) ?? 0,
    toInt(low_stock_alert) ?? 5,
    image1, image2, image3,
    toDecimal(weight),
    dimensions    || null,
    toBool(is_featured, 0),
    toBool(active, 1),
    // car fields — all optional
    car_make              || null,
    car_model             || null,
    toInt(car_year_from),
    toInt(car_year_to),
    car_variant           || null,
    engine_size           || null,
    fuel_type             || null,
    transmission          || null,
    drive_type            || null,
    part_number           || null,
    oem_number            || null,
    condition_type        || null,
    placement             || null,
    compatibility_notes   || null,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Insert error:', err);
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Slug already exists' });
      return res.status(500).json({ message: 'Database error', detail: err.message });
    }
    res.status(201).json({ id: result.insertId, message: 'Product created' });
  });
});

router.put('/products/:id', protect, productImages, (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM shop_products WHERE id=?', [id], (err, rows) => {
    if (err)          return res.status(500).json({ message: 'Database error' });
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

    const sql = `
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
    `;

    const values = [
      catId, name, slug, description || '',
      toDecimal(price) ?? 0,
      toDecimal(sale_price),
      toDecimal(discount_percent) ?? 0,
      sku || null,
      toInt(quantity) ?? 0,
      toInt(low_stock_alert) ?? 5,
      image1, image2, image3,
      toDecimal(weight),
      dimensions    || null,
      toBool(is_featured, 0),
      toBool(active, 1),
      car_make            || null,
      car_model           || null,
      toInt(car_year_from),
      toInt(car_year_to),
      car_variant         || null,
      engine_size         || null,
      fuel_type           || null,
      transmission        || null,
      drive_type          || null,
      part_number         || null,
      oem_number          || null,
      condition_type      || null,
      placement           || null,
      compatibility_notes || null,
      id,
    ];

    db.query(sql, values, (err2, result) => {
      if (err2) {
        console.error('Update error:', err2);
        if (err2.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Slug already exists' });
        return res.status(500).json({ message: 'Database error', detail: err2.message });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
      res.json({ message: 'Product updated' });
    });
  });
});

router.put('/products/:id/toggle-active', protect, (req, res) => {
  const { active } = req.body;
  db.query(
    'UPDATE shop_products SET active=? WHERE id=?',
    [toBool(active, 0), req.params.id],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
      res.json({ message: 'Status updated' });
    }
  );
});

router.delete('/products/:id', protect, (req, res) => {
  db.query('SELECT * FROM shop_products WHERE id=?', [req.params.id], (err, rows) => {
    if (err)          return res.status(500).json({ message: 'Database error' });
    if (!rows.length) return res.status(404).json({ message: 'Product not found' });

    const p = rows[0];
    removeFile(p.image1); removeFile(p.image2); removeFile(p.image3);

    db.query('DELETE FROM shop_products WHERE id=?', [req.params.id], (err2, result) => {
      if (err2) { console.error(err2); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
      res.json({ message: 'Product deleted' });
    });
  });
});

// ════════════════════════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════════════════════════
router.get('/orders', protect, (req, res) => {
  db.query('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    res.json(rows);
  });
});

router.get('/orders/:id', protect, (req, res) => {
  db.query('SELECT * FROM orders WHERE id=?', [req.params.id], (err, orders) => {
    if (err)            return res.status(500).json({ message: 'Database error' });
    if (!orders.length) return res.status(404).json({ message: 'Order not found' });
    db.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id], (err2, items) => {
      if (err2) { console.error(err2); return res.status(500).json({ message: 'Database error' }); }
      res.json({ ...orders[0], items });
    });
  });
});

router.post('/orders', protect, (req, res) => {
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

  db.query(
    `INSERT INTO orders
       (order_number, customer_name, customer_email, customer_phone,
        shipping_address, subtotal, discount_amount, shipping_cost, total,
        status, payment_status, payment_method, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      orderNumber,
      customer_name, customer_email, customer_phone || null,
      shipping_address || null,
      toDecimal(subtotal)        ?? 0,
      toDecimal(discount_amount) ?? 0,
      toDecimal(shipping_cost)   ?? 0,
      toDecimal(total)           ?? 0,
      'pending', 'unpaid',
      payment_method || null,
      notes          || null,
    ],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      const orderId = result.insertId;
      const itemValues = items.map(item => [
        orderId,
        item.product_id   || null,
        item.product_name || 'Unknown',
        item.sku          || null,
        toInt(item.quantity)        ?? 1,
        toDecimal(item.unit_price)  ?? 0,
        toDecimal(item.total_price) ?? 0,
      ]);
      db.query(
        'INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, total_price) VALUES ?',
        [itemValues],
        (err2) => {
          if (err2) { console.error(err2); return res.status(500).json({ message: 'Order created but items failed' }); }
          if (coupon_code) {
            db.query('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [coupon_code.toUpperCase()],
              (err3) => { if (err3) console.error('Coupon update error:', err3); });
          }
          res.status(201).json({ id: orderId, order_number: orderNumber, message: 'Order created' });
        }
      );
    }
  );
});

router.put('/orders/:id/status', protect, (req, res) => {
  const { status, payment_status } = req.body;
  db.query(
    'UPDATE orders SET status=?, payment_status=? WHERE id=?',
    [status, payment_status, req.params.id],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
      res.json({ message: 'Order status updated' });
    }
  );
});

router.delete('/orders/:id', protect, (req, res) => {
  db.query('DELETE FROM orders WHERE id=?', [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  });
});

// ════════════════════════════════════════════════════════════
// COUPONS
// ════════════════════════════════════════════════════════════
router.get('/coupons', protect, (req, res) => {
  db.query('SELECT * FROM coupons ORDER BY created_at DESC', (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    res.json(rows);
  });
});

router.post('/coupons/validate', (req, res) => {
  const { code, order_value } = req.body;
  if (!code) return res.status(400).json({ message: 'Coupon code is required' });
  db.query('SELECT * FROM coupons WHERE code=? AND active=1', [code.toUpperCase()], (err, rows) => {
    if (err)          return res.status(500).json({ message: 'Database error' });
    if (!rows.length) return res.status(404).json({ message: 'Invalid or inactive coupon' });
    const coupon = rows[0];
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
      return res.status(400).json({ message: 'Coupon has expired' });
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    if (coupon.min_order_value > 0 && parseFloat(order_value) < coupon.min_order_value)
      return res.status(400).json({ message: `Minimum order value of R${parseFloat(coupon.min_order_value).toFixed(2)} required` });
    res.json({ valid: true, coupon });
  });
});

router.post('/coupons', protect, (req, res) => {
  const { code, description, discount_type, discount_value, min_order_value, max_uses, expires_at, active } = req.body;
  if (!code || !discount_value) return res.status(400).json({ message: 'Code and discount value are required' });
  db.query(
    `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_uses, expires_at, active)
     VALUES (?,?,?,?,?,?,?,?)`,
    [code.toUpperCase(), description || '', discount_type || 'percent',
     toDecimal(discount_value) ?? 0, toDecimal(min_order_value) ?? 0,
     toInt(max_uses), expires_at || null, toBool(active, 1)],
    (err, result) => {
      if (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Coupon code already exists' });
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: result.insertId, message: 'Coupon created' });
    }
  );
});

router.put('/coupons/:id', protect, (req, res) => {
  const { code, description, discount_type, discount_value, min_order_value, max_uses, expires_at, active } = req.body;
  db.query(
    `UPDATE coupons SET code=?, description=?, discount_type=?, discount_value=?,
     min_order_value=?, max_uses=?, expires_at=?, active=? WHERE id=?`,
    [code?.toUpperCase(), description || '', discount_type || 'percent',
     toDecimal(discount_value) ?? 0, toDecimal(min_order_value) ?? 0,
     toInt(max_uses), expires_at || null, toBool(active, 1), req.params.id],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Coupon not found' });
      res.json({ message: 'Coupon updated' });
    }
  );
});

router.delete('/coupons/:id', protect, (req, res) => {
  db.query('DELETE FROM coupons WHERE id=?', [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Database error' }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ message: 'Coupon deleted' });
  });
});

module.exports = router;