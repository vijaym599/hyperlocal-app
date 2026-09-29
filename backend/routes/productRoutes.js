const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const authenticate = require('../middleware/auth');

// Multer Temporary File Storage setup
const upload = multer({ dest: 'uploads/' });

// Helper: Check if user owns the shop (Checks both user_id and owner_id)
const ensureShopOwner = async (shopId, userId) => {
  const result = await pool.query(
    'SELECT id FROM shops WHERE id = $1 AND (user_id = $2 OR owner_id = $2)',
    [shopId, userId]
  );
  return result.rows.length > 0;
};

// ==========================================
// 1. ADD SINGLE PRODUCT API -> POST /api/products/add
// ==========================================
router.post('/add', authenticate, async (req, res) => {
  const { shop_id, product_name, name, description, price, image_url } = req.body;
  const prodName = product_name || name;

  if (!shop_id || !prodName || !price) {
    return res.status(400).json({ error: 'shop_id, product_name மற்றும் price கட்டாயம் தேவை.' });
  }

  try {
    if (!(await ensureShopOwner(shop_id, req.user.userId))) {
      return res.status(403).json({ error: 'You can only add products to your own shop.' });
    }

    const subQuery = `SELECT product_limit FROM subscriptions WHERE shop_id = $1;`;
    const subResult = await pool.query(subQuery, [shop_id]);
    const productLimit = subResult.rows.length > 0 ? subResult.rows[0].product_limit : 10;

    const countQuery = `SELECT COUNT(*) FROM products WHERE shop_id = $1;`;
    const countResult = await pool.query(countQuery, [shop_id]);
    const currentCount = parseInt(countResult.rows[0].count);

    if (currentCount >= productLimit) {
      return res.status(400).json({
        error: `பொருட்களின் வரம்பு முடிந்தது! உங்கள் Plan மூலம் அதிகபட்சமாக ${productLimit} பொருட்களை மட்டுமே சேர்க்க முடியும்.`
      });
    }

    const insertQuery = `
      INSERT INTO products (shop_id, name, description, price, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const newProduct = await pool.query(insertQuery, [
      shop_id, prodName, description || '', parseFloat(price), image_url || null
    ]);

    res.status(201).json({ message: 'பொருள் வெற்றிகரமாக சேர்க்கப்பட்டது!', product: newProduct.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'பிழை ஏற்பட்டது: ' + err.message });
  }
});

// ==========================================
// 2. CSV BULK PRODUCT UPLOAD API -> POST /api/products/bulk-upload
// ==========================================
router.post('/bulk-upload', authenticate, upload.single('file'), async (req, res) => {
  const shop_id = req.body.shop_id;
  const file = req.file;

  if (!shop_id || !file) {
    return res.status(400).json({ error: 'shop_id மற்றும் CSV ஃபைல் கட்டாயம் தேவை.' });
  }

  try {
    if (!(await ensureShopOwner(shop_id, req.user.userId))) {
      fs.unlinkSync(file.path);
      return res.status(403).json({ error: 'You can only add products to your own shop.' });
    }
  } catch (err) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(500).json({ error: 'Unable to verify shop ownership.' });
  }

  const productsFromCSV = [];

  // 1. Read CSV File
  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', (row) => {
      const pName = row.product_name || row.name;
      if (pName && row.price) {
        productsFromCSV.push({
          product_name: pName,
          description: row.description || '',
          price: parseFloat(row.price),
          image_url: row.image_url || null
        });
      }
    })
    .on('end', async () => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      if (productsFromCSV.length === 0) {
        return res.status(400).json({ error: 'CSV ஃபைலில் தகவல்கள் எதுவும் இல்லை.' });
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // 2. Subscription Limit Check
        const subResult = await client.query(`SELECT product_limit FROM subscriptions WHERE shop_id = $1;`, [shop_id]);
        const productLimit = subResult.rows.length > 0 ? subResult.rows[0].product_limit : 10;

        const countResult = await client.query(`SELECT COUNT(*) FROM products WHERE shop_id = $1;`, [shop_id]);
        const currentCount = parseInt(countResult.rows[0].count);

        const totalAfterUpload = currentCount + productsFromCSV.length;

        if (totalAfterUpload > productLimit) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `அப்லோட் செய்ய முடியவில்லை! உங்கள் லிமிட் ${productLimit}. தற்போது ${currentCount} பொருட்கள் உள்ளன. ${productsFromCSV.length} பொருட்களைச் சேர்த்தால் லிமிட் தாண்டிவிடும்.`
          });
        }

        // 3. Bulk Insert into Database
        const insertedProducts = [];
        for (const item of productsFromCSV) {
          const insertQuery = `
            INSERT INTO products (shop_id, name, description, price, image_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
          `;
          const result = await client.query(insertQuery, [
            shop_id, item.product_name, item.description, item.price, item.image_url
          ]);
          insertedProducts.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.status(201).json({
          message: `${insertedProducts.length} பொருட்கள் வெற்றிகரமாக அப்லோட் செய்யப்பட்டன!`,
          total_uploaded: insertedProducts.length,
          products: insertedProducts
        });

      } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Bulk Upload-ல் பிழை ஏற்பட்டது: ' + err.message });
      } finally {
        client.release();
      }
    });
});

// ==========================================
// 3. EDIT / UPDATE PRODUCT API -> PUT /api/products/:id
// ==========================================
router.put('/:id', async (req, res) => {
  const productId = req.params.id;
  const { name, product_name, price, image_url, shop_id } = req.body;
  const prodName = name || product_name;

  try {
    if (!prodName || price === undefined) {
      return res.status(400).json({ error: "Product பெயர் மற்றும் விலை கட்டாயம் தேவை." });
    }

    let updateQuery;
    let values;

    // shop_id அனுப்பப்பட்டால் அதை வைத்தும் சரிபார்க்கும்
    if (shop_id) {
      updateQuery = `
        UPDATE products 
        SET name = $1, price = $2, image_url = $3 
        WHERE id = $4 AND shop_id = $5 
        RETURNING *;
      `;
      values = [prodName, parseFloat(price), image_url || null, productId, shop_id];
    } else {
      updateQuery = `
        UPDATE products 
        SET name = $1, price = $2, image_url = $3 
        WHERE id = $4 
        RETURNING *;
      `;
      values = [prodName, parseFloat(price), image_url || null, productId];
    }

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product கிடைக்கவில்லை அல்லது இந்த கடைக்கு சொந்தமானது அல்ல." });
    }

    return res.json({
      message: "Product வெற்றிகரமாக புதுப்பிக்கப்பட்டது!",
      product: result.rows[0]
    });

  } catch (err) {
    console.error("Edit Product Error:", err);
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
});

// ==========================================
// 4. GET SINGLE PRODUCT -> GET /api/products/:id
// ==========================================
router.get('/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product கிடைக்கவில்லை.' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch Single Product Error:', err);
    return res.status(500).json({ error: 'Server Error: ' + err.message });
  }
});

module.exports = router;