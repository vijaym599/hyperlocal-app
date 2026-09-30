const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const authenticate = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = String(process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const rateLimitStore = new Map();
const reverseGeocodeCache = new Map();

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : (process.env.NODE_ENV === 'production' ? false : true),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));
app.use(express.json({ limit: '10mb' }));

const rateLimit = (limit, windowMs) => (req, res, next) => {
  const key = `${req.ip}:${req.baseUrl}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  if (entry.count >= limit) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  entry.count += 1;
  return next();
};

app.use('/api/auth', rateLimit(20, 15 * 60 * 1000));

const SUBSCRIPTION_LIMITS = {
  basic: 10,
  pro: 100,
  advance: 300,
  enterprise: 999999
};
const VERIFIED_SUBSCRIPTION_PLANS = new Set(['pro', 'advance', 'enterprise']);

const AVAILABILITY_STATUSES = new Set(['available', 'low_stock', 'out_of_stock']);
const productFallbackImage = (name, brand = '') => `https://loremflickr.com/640/480/${encodeURIComponent(`${brand || ''} ${name || 'local product'}`.trim())}`;

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { userId: user.id, email: user.email, userType: user.user_type || 'customer', isAdmin: Boolean(user.is_admin) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const recordActivity = (userId, actionType, { shopId = null, productId = null, details = {} }) =>
  pool.query(
    `INSERT INTO user_activities (user_id, action_type, shop_id, product_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, actionType, shopId, productId, JSON.stringify(details)]
  );

const isShopOwner = async (shopId, userId) => {
  const result = await pool.query(
    'SELECT id FROM shops WHERE id = $1 AND user_id = $2',
    [shopId, userId]
  );
  return result.rows.length > 0;
};

const isAdmin = async (userId) => {
  const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  return Boolean(result.rows[0]?.is_admin);
};

const requireCustomer = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT user_type FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows[0]?.user_type !== 'customer') return res.status(403).json({ error: 'This action is available only to customer accounts.' });
    return next();
  } catch {
    return res.status(500).json({ error: 'Unable to verify account access.' });
  }
};

app.get('/api/location/reverse', rateLimit(30, 60 * 60 * 1000), async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 30 * 60 * 1000) return res.json(cached.value);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${latitude}&lon=${longitude}`, {
      headers: {
        'User-Agent': process.env.GEOCODER_USER_AGENT || 'Nearbuy/1.0',
        'Accept-Language': 'en'
      }
    });
    if (!response.ok) throw new Error(`Geocoding provider returned ${response.status}`);
    const data = await response.json();
    const address = data.address || {};
    const placeName = [address.suburb || address.neighbourhood || address.village, address.city || address.town || address.county || address.state_district].filter(Boolean).join(', ') || data.display_name?.split(',').slice(0, 2).join(', ') || 'Current location';
    const value = { place_name: placeName };
    reverseGeocodeCache.set(cacheKey, { value, createdAt: Date.now() });
    return res.json(value);
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return res.status(502).json({ error: 'Unable to identify the current place.' });
  }
});

// ==========================================
// 1. REGISTER SHOP & USER (PostgreSQL)
// ==========================================
app.post('/api/auth/register-shop', async (req, res) => {
  let client;
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Authentication is not configured on the server.' });
    }

    const { 
      owner_name, 
      email, 
      password, 
      shop_name, 
      category,
      address,
      latitude, 
      longitude, 
      google_map_link, 
      phone,
      whatsapp_number,
      opening_hours,
      opening_time,
      closing_time,
      selected_plan, 
      payment_id 
    } = req.body;

    if (!email || !password || !shop_name) {
      return res.status(400).json({ error: 'Email, Password, and Shop Name are required!' });
    }
    if (!Object.hasOwn(SUBSCRIPTION_LIMITS, selected_plan) || !payment_id) {
      return res.status(400).json({ error: 'Choose one of the four subscription plans to create a shop account.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must contain at least 8 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (latitude === '' || longitude === '' || !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      return res.status(400).json({ error: 'A valid shop latitude and longitude are required.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This Email is already registered!' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (owner_name, email, password, user_type)
       VALUES ($1, $2, $3, 'shop_owner')
       RETURNING id, email, owner_name, user_type, is_admin`,
      [owner_name?.trim() || '', cleanEmail, passwordHash]
    );

    const newUser = userResult.rows[0];

    const shopResult = await client.query(
      `INSERT INTO shops
        (user_id, name, category, address, latitude, longitude, google_map_link, phone, whatsapp_number, opening_hours, opening_time, closing_time, subscription_plan, payment_id, is_verified, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CASE WHEN $15 THEN CURRENT_TIMESTAMP ELSE NULL END)
       RETURNING *`,
      [
        newUser.id,
        shop_name.trim(),
        category || 'Others',
        address?.trim() || null,
        parsedLatitude,
        parsedLongitude,
        google_map_link?.trim() || '',
        phone?.trim() || null,
        whatsapp_number?.trim() || null,
        opening_hours?.trim() || null,
        opening_time || null,
        closing_time || null,
        selected_plan || 'free',
        payment_id || null,
        VERIFIED_SUBSCRIPTION_PLANS.has(selected_plan)
      ]
    );

    const newShop = shopResult.rows[0];
    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Shop created successfully',
      token: createToken(newUser),
      user: newUser,
      shop: newShop
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error("Register Error in Backend:", err.message);
    return res.status(500).json({ error: 'Database/Server Error: ' + err.message });
  } finally {
    client?.release();
  }
});

// Customer accounts are independent from shop-owner accounts.
const registerCustomer = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Authentication is not configured on the server.' });
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required.' });
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
    const result = await pool.query(
      `INSERT INTO users (owner_name, email, password, user_type) VALUES ($1, $2, $3, 'customer')
       RETURNING id, owner_name, email, user_type, is_admin`,
      [name, email, await bcrypt.hash(password, 12)]
    );
    const user = result.rows[0];
    return res.status(201).json({ message: 'Customer account created.', token: createToken(user), user, shop: null });
  } catch (err) {
    console.error('Customer registration error:', err);
    return res.status(500).json({ error: 'Unable to create your account.' });
  }
};

app.post('/api/auth/register-customer', registerCustomer);
// Retain compatibility with an earlier client typo while new clients use the route above.
app.post('/api/auth/register-custormer', registerCustomer);

// ==========================================
// 2. LOGIN API (PostgreSQL)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and Password missing!' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Authentication is not configured on the server.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Email ID or Password!' });
    }

    const user = userRes.rows[0];
    const storedPassword = user.password || '';
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);
    const passwordMatches = isBcryptHash
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid Email ID or Password!' });
    }

    // Upgrade legacy plaintext passwords on the account's next successful login.
    if (!isBcryptHash) {
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(password, 12), user.id]);
    }

    const shopRes = await pool.query('SELECT * FROM shops WHERE user_id = $1', [user.id]);
    const shop = shopRes.rows[0] || null;
    if (shop && user.user_type !== 'shop_owner') {
      user.user_type = 'shop_owner';
      await pool.query("UPDATE users SET user_type = 'shop_owner' WHERE id = $1", [user.id]);
    }

    return res.json({
      message: 'Login successful!',
      token: createToken(user),
      user: { id: user.id, email: user.email, owner_name: user.owner_name, user_type: user.user_type || (shop ? 'shop_owner' : 'customer'), is_admin: user.is_admin },
      shop: shop
    });

  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// ==========================================
// 3. FETCH PRODUCTS OF A SHOP (PostgreSQL)
// ==========================================
app.get('/api/shops/:shopId/products', async (req, res) => {
  const shopId = req.params.shopId;

  try {
    const productsRes = await pool.query('SELECT * FROM products WHERE shop_id = $1 ORDER BY id DESC', [shopId]);
    return res.json({ products: productsRes.rows });
  } catch (err) {
    console.error('Fetch Products Error:', err);
    return res.status(500).json({ error: 'Failed to fetch products from PostgreSQL.' });
  }
});

// Public shop portfolio: a complete catalog for one shop, independent of nearby search filters.
app.get('/api/shops/:shopId/portfolio', async (req, res) => {
  const shopId = Number(req.params.shopId);
  if (!shopId) return res.status(400).json({ error: 'A valid shop is required.' });
  try {
    const [shopResult, productsResult] = await Promise.all([
      pool.query(
        `SELECT s.*, COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM shop_reviews WHERE shop_id = s.id), 0) AS average_rating,
                (SELECT COUNT(*)::int FROM shop_reviews WHERE shop_id = s.id) AS review_count
         FROM shops s WHERE s.id = $1`, [shopId]
      ),
      pool.query(
        `SELECT p.*, COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM product_reviews WHERE product_id = p.id), 0) AS average_rating,
                (SELECT COUNT(*)::int FROM product_reviews WHERE product_id = p.id) AS review_count
         FROM products p WHERE p.shop_id = $1 ORDER BY p.name ASC`, [shopId]
      )
    ]);
    if (!shopResult.rows.length) return res.status(404).json({ error: 'Shop not found.' });
    return res.json({ shop: shopResult.rows[0], products: productsResult.rows });
  } catch (err) {
    console.error('Shop portfolio error:', err);
    return res.status(500).json({ error: 'Unable to load this shop portfolio.' });
  }
});

app.patch('/api/shops/:shopId/subscription', authenticate, async (req, res) => {
  const shopId = Number(req.params.shopId);
  const { action, plan, payment_id } = req.body || {};
  if (!shopId || !['change', 'cancel', 'resume'].includes(action)) return res.status(400).json({ error: 'A valid subscription action is required.' });
  try {
    if (!(await isShopOwner(shopId, req.user.userId))) return res.status(403).json({ error: 'You can only manage your own subscription.' });
    let result;
    if (action === 'cancel') {
      result = await pool.query(`UPDATE shops SET subscription_status = 'cancelled', subscription_cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [shopId]);
    } else {
      if (!Object.hasOwn(SUBSCRIPTION_LIMITS, plan) || !payment_id) return res.status(400).json({ error: 'Choose a valid paid plan and complete payment.' });
      const verified = VERIFIED_SUBSCRIPTION_PLANS.has(plan);
      result = await pool.query(`UPDATE shops SET subscription_plan = $1, payment_id = $2, subscription_status = 'active', subscription_cancelled_at = NULL, is_verified = $3, verified_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`, [plan, payment_id, verified, shopId]);
    }
    return res.json({ message: action === 'cancel' ? 'Subscription renewal cancelled.' : 'Subscription updated.', shop: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: 'Unable to update subscription.' }); }
});

// ==========================================
// 4. ADD PRODUCT (PostgreSQL)
// ==========================================
app.post('/api/shops/:shopId/products', authenticate, async (req, res) => {
  const shopId = Number(req.params.shopId);
  const { name, description, brand, price, image_url, availability_status } = req.body;
  const parsedPrice = Number(price);

  if (!shopId) return res.status(400).json({ error: 'Invalid Shop ID!' });
  if (!name?.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: 'A product name and a valid price are required!' });
  }
  if (availability_status && !AVAILABILITY_STATUSES.has(availability_status)) {
    return res.status(400).json({ error: 'Invalid availability status.' });
  }

  try {
    const shopRes = await pool.query('SELECT * FROM shops WHERE id = $1', [shopId]);
    if (shopRes.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found in PostgreSQL Database!' });
    }
    const shop = shopRes.rows[0];

    if (!(await isShopOwner(shopId, req.user.userId))) {
      return res.status(403).json({ error: 'You can only manage products for your own shop.' });
    }

    // Check Limit
    const countRes = await pool.query('SELECT COUNT(*) FROM products WHERE shop_id = $1', [shopId]);
    const productCount = parseInt(countRes.rows[0].count);
    const planLimit = SUBSCRIPTION_LIMITS[shop.subscription_plan] || 10;

    if (productCount >= planLimit) {
      return res.status(400).json({ error: `Limit reached! Your current plan allows only ${planLimit} products.` });
    }

    const prodImg = (image_url && image_url.trim() !== '') ? image_url : productFallbackImage(name, brand);

    const newProductRes = await pool.query(
      `INSERT INTO products
        (shop_id, name, description, brand, price, image_url, availability_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        shopId,
        name.trim(),
        description?.trim() || null,
        brand?.trim() || null,
        parsedPrice,
        prodImg,
        availability_status || 'available'
      ]
    );

    return res.status(201).json({ message: 'Product added successfully!', product: newProductRes.rows[0] });

  } catch (err) {
    console.error('Add Product Error:', err);
    return res.status(500).json({ error: 'Failed to insert product.' });
  }
});

app.post('/api/shops/:shopId/products/bulk', authenticate, async (req, res) => {
  const shopId = Number(req.params.shopId); const incoming = Array.isArray(req.body?.products) ? req.body.products : [];
  if (!shopId || !incoming.length || incoming.length > 200) return res.status(400).json({ error: 'Upload between 1 and 200 products.' });
  try {
    if (!(await isShopOwner(shopId, req.user.userId))) return res.status(403).json({ error: 'You can only manage products for your own shop.' });
    const shop = (await pool.query('SELECT subscription_plan FROM shops WHERE id = $1', [shopId])).rows[0];
    if (!shop) return res.status(404).json({ error: 'Shop not found.' });
    const existingCount = Number((await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE shop_id = $1', [shopId])).rows[0].count);
    const limit = SUBSCRIPTION_LIMITS[shop.subscription_plan] || 10;
    if (existingCount + incoming.length > limit) return res.status(400).json({ error: `Your plan allows ${limit} products. You can add ${Math.max(0, limit - existingCount)} more.` });
    const values = incoming.map((item, index) => {
      const name = String(item.name || '').trim(); const price = Number(item.price);
      if (!name || !Number.isFinite(price) || price < 0) throw new Error(`Row ${index + 1} needs a product name and valid price.`);
      const status = item.availability_status || 'available'; if (!AVAILABILITY_STATUSES.has(status)) throw new Error(`Row ${index + 1} has an invalid availability status.`);
      const brand = String(item.brand || '').trim(); const image = String(item.image_url || '').trim() || productFallbackImage(name, brand);
      return [shopId, name, String(item.description || '').trim() || null, brand || null, price, image, status];
    });
    const placeholders = values.map((_, index) => `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`).join(', ');
    const result = await pool.query(`INSERT INTO products (shop_id, name, description, brand, price, image_url, availability_status) VALUES ${placeholders} RETURNING *`, values.flat());
    return res.status(201).json({ message: `${result.rows.length} products added.`, products: result.rows });
  } catch (err) { return res.status(400).json({ error: err.message || 'Bulk upload failed.' }); }
});

// ==========================================
// 5. UPDATE SHOP DETAILS
// ==========================================
app.put('/api/shops/:shopId', authenticate, async (req, res) => {
  const shopId = Number(req.params.shopId);
  const { name, category, address, latitude, longitude, google_map_link, phone, whatsapp_number, opening_hours, opening_time, closing_time } = req.body;

  if (!shopId || !name?.trim() || !category) {
    return res.status(400).json({ error: 'Shop name and category are required.' });
  }
  if (
    (latitude !== '' && latitude !== undefined && !Number.isFinite(Number(latitude))) ||
    (longitude !== '' && longitude !== undefined && !Number.isFinite(Number(longitude)))
  ) {
    return res.status(400).json({ error: 'Latitude and longitude must be valid numbers.' });
  }

  try {
    if (!(await isShopOwner(shopId, req.user.userId))) {
      return res.status(403).json({ error: 'You can only update your own shop.' });
    }

    const result = await pool.query(
      `UPDATE shops
       SET name = $1, category = $2,
           address = COALESCE($3, address),
           latitude = COALESCE($4, latitude), longitude = COALESCE($5, longitude),
           google_map_link = $6,
           phone = COALESCE($7, phone),
           whatsapp_number = COALESCE($8, whatsapp_number),
           opening_hours = COALESCE($9, opening_hours),
           opening_time = $10,
           closing_time = $11,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        name.trim(),
        category,
        address?.trim() || null,
        latitude === '' || latitude === undefined ? null : Number(latitude),
        longitude === '' || longitude === undefined ? null : Number(longitude),
        google_map_link?.trim() || '',
        phone?.trim() || null,
        whatsapp_number?.trim() || null,
        opening_hours?.trim() || null,
        opening_time || null,
        closing_time || null,
        shopId
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Shop not found.' });
    return res.json({ message: 'Shop details updated successfully.', shop: result.rows[0] });
  } catch (err) {
    console.error('Update Shop Error:', err);
    return res.status(500).json({ error: 'Failed to update shop details: ' + err.message });
  }
});

app.patch('/api/shops/:shopId/open-status', authenticate, async (req, res) => {
  const shopId = Number(req.params.shopId);
  const { is_open } = req.body;
  if (!shopId || typeof is_open !== 'boolean') {
    return res.status(400).json({ error: 'A valid shop status is required.' });
  }

  try {
    if (!(await isShopOwner(shopId, req.user.userId))) {
      return res.status(403).json({ error: 'You can only update your own shop status.' });
    }
    const result = await pool.query(
      `UPDATE shops
       SET is_open = $1, open_status_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [is_open, shopId]
    );
    return res.json({ message: 'Shop status updated.', shop: result.rows[0] });
  } catch (err) {
    console.error('Shop status update error:', err);
    return res.status(500).json({ error: 'Unable to update shop status.' });
  }
});

// ==========================================
// 6. EDIT / UPDATE PRODUCT (FIXED for PostgreSQL)
// ==========================================
app.put('/api/products/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, description, brand, price, image_url, availability_status } = req.body;
  const parsedPrice = Number(price);

  if (!name?.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: 'Product name and price are required!' });
  }
  if (availability_status && !AVAILABILITY_STATUSES.has(availability_status)) {
    return res.status(400).json({ error: 'Invalid availability status.' });
  }

  try {
    const defaultImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300';
    const prodImg = (image_url && image_url.trim() !== '') ? image_url : defaultImg;

    const sql = `
      UPDATE products p
      SET name = $1, description = COALESCE($2, p.description), brand = COALESCE($3, p.brand),
          price = $4, image_url = $5,
          availability_status = COALESCE($6, p.availability_status),
          availability_updated_at = CASE WHEN $6 IS NULL THEN p.availability_updated_at ELSE CURRENT_TIMESTAMP END,
          updated_at = CURRENT_TIMESTAMP
      FROM shops s
      WHERE p.id = $7 AND p.shop_id = s.id AND s.user_id = $8
      RETURNING p.*
    `;

    const result = await pool.query(sql, [
      name.trim(),
      description?.trim() || null,
      brand?.trim() || null,
      parsedPrice,
      prodImg,
      availability_status || null,
      id,
      req.user.userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found, or you do not own its shop.' });
    }

    return res.json({ 
      message: 'Product updated successfully', 
      product: result.rows[0] 
    });

  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ error: 'Failed to update product in database: ' + err.message });
  }
});

app.delete('/api/products/:id', authenticate, async (req, res) => {
  const productId = Number(req.params.id);
  if (!productId) return res.status(400).json({ error: 'Invalid product ID.' });
  try {
    const result = await pool.query(
      `DELETE FROM products p
       USING shops s
       WHERE p.id = $1 AND p.shop_id = s.id AND s.user_id = $2
       RETURNING p.id`,
      [productId, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found, or you do not own its shop.' });
    return res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: 'Unable to delete product.' });
  }
});

// ==========================================
// 6. GET SINGLE PRODUCT BY ID
// ==========================================
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Product Error:', err);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.get('/api/reviews/:target/:id', async (req, res) => {
  const { target } = req.params;
  const id = Number(req.params.id);
  if (!id || !['shop', 'product'].includes(target)) return res.status(400).json({ error: 'Invalid review target.' });
  const table = target === 'shop' ? 'shop_reviews' : 'product_reviews';
  const column = target === 'shop' ? 'shop_id' : 'product_id';
  try {
    const [summary, reviews] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS review_count, COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average_rating FROM ${table} WHERE ${column} = $1`, [id]),
      pool.query(`SELECT r.id, r.rating, r.comment, r.created_at, u.owner_name FROM ${table} r JOIN users u ON u.id = r.user_id WHERE r.${column} = $1 ORDER BY r.updated_at DESC LIMIT 10`, [id])
    ]);
    return res.json({ summary: summary.rows[0], reviews: reviews.rows });
  } catch (err) { return res.status(500).json({ error: 'Unable to load reviews.' }); }
});

app.post('/api/reviews/:target/:id', authenticate, requireCustomer, async (req, res) => {
  const { target } = req.params;
  const id = Number(req.params.id); const rating = Number(req.body?.rating); const comment = String(req.body?.comment || '').trim();
  if (!id || !['shop', 'product'].includes(target) || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500) return res.status(400).json({ error: 'Provide a rating from 1 to 5 and a review under 500 characters.' });
  const table = target === 'shop' ? 'shop_reviews' : 'product_reviews'; const column = target === 'shop' ? 'shop_id' : 'product_id';
  try {
    const result = await pool.query(`INSERT INTO ${table} (${column}, user_id, rating, comment) VALUES ($1, $2, $3, $4) ON CONFLICT (${column}, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP RETURNING id, rating, comment`, [id, req.user.userId, rating, comment || null]);
    const productId = target === 'product' ? id : null;
    const shopId = target === 'shop' ? id : (await pool.query('SELECT shop_id FROM products WHERE id = $1', [id])).rows[0]?.shop_id || null;
    await recordActivity(req.user.userId, 'review', { shopId, productId, details: { target, rating } });
    return res.status(201).json({ message: 'Review saved.', review: result.rows[0] });
  } catch (err) { return res.status(500).json({ error: 'Unable to save review.' }); }
});

app.post('/api/activity/:action', authenticate, requireCustomer, async (req, res) => {
  const action = req.params.action;
  const shopId = Number(req.body?.shop_id) || null;
  const productId = Number(req.body?.product_id) || null;
  if (!['call', 'directions'].includes(action) || !shopId) return res.status(400).json({ error: 'A valid shop activity is required.' });
  try {
    const shop = await pool.query('SELECT id, name FROM shops WHERE id = $1', [shopId]);
    if (!shop.rows.length) return res.status(404).json({ error: 'Shop not found.' });
    await recordActivity(req.user.userId, action, { shopId, productId, details: { shop_name: shop.rows[0].name } });
    return res.status(201).json({ message: 'Activity saved.' });
  } catch (err) { return res.status(500).json({ error: 'Unable to save activity.' }); }
});

app.get('/api/activity', authenticate, requireCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.action_type, a.created_at, a.details, s.id AS shop_id, s.name AS shop_name,
              p.id AS product_id, p.name AS product_name
       FROM user_activities a
       LEFT JOIN shops s ON s.id = a.shop_id
       LEFT JOIN products p ON p.id = a.product_id
       WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [req.user.userId]
    );
    return res.json({ activities: result.rows });
  } catch (err) { return res.status(500).json({ error: 'Unable to load activity.' }); }
});

// ==========================================
// 7. PRODUCT-FIRST NEARBY SEARCH
// ==========================================
app.get('/api/search/products', async (req, res) => {
  const { lat, lng, query = '', availability = 'all' } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lng);
  const radiusValue = String(req.query.radius || '').trim();
  const requestedRadius = radiusValue ? Number(radiusValue) : null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }
  if (requestedRadius !== null && (!Number.isFinite(requestedRadius) || requestedRadius <= 0)) {
    return res.status(400).json({ error: 'Radius must be a positive number.' });
  }
  if (!['all', 'available'].includes(availability)) {
    return res.status(400).json({ error: 'Availability filter must be all or available.' });
  }

  // “All distances” in the UI is intentionally broad but bounded at 1200 km.
  const radiusKm = requestedRadius === null ? 1200 : Math.min(requestedRadius, 1200);
  const searchTerm = `%${String(query).trim()}%`;

  try {
    const result = await pool.query(
      `
        WITH ranked_products AS (
          SELECT
            p.id, p.name, p.description, p.brand, p.price, p.image_url,
            p.availability_status, p.availability_updated_at, p.updated_at AS catalog_updated_at,
            s.id AS shop_id, s.name AS shop_name, s.category AS shop_category,
            s.address, s.latitude, s.longitude, s.google_map_link,
            s.phone, s.whatsapp_number, s.opening_hours, s.is_open, s.open_status_updated_at,
            s.is_verified, s.verified_at,
            COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM product_reviews WHERE product_id = p.id), 0) AS product_average_rating,
            (SELECT COUNT(*)::int FROM product_reviews WHERE product_id = p.id) AS product_review_count,
            COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM shop_reviews WHERE shop_id = s.id), 0) AS shop_average_rating,
            (SELECT COUNT(*)::int FROM shop_reviews WHERE shop_id = s.id) AS shop_review_count,
            6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians($1)) * cos(radians(s.latitude)) *
              cos(radians(s.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(s.latitude))
            ))) AS distance_km
          FROM products p
          JOIN shops s ON s.id = p.shop_id
          WHERE (
            p.name ILIKE $3 OR p.brand ILIKE $3 OR p.description ILIKE $3 OR s.name ILIKE $3
          )
          AND ($5 = 'all' OR p.availability_status = $5)
        )
        SELECT *
        FROM ranked_products
        WHERE distance_km <= $4
        ORDER BY
          CASE availability_status
            WHEN 'available' THEN 0
            WHEN 'low_stock' THEN 1
            ELSE 2
          END,
          distance_km ASC,
          price ASC
        LIMIT 500;
      `,
      [latitude, longitude, searchTerm, radiusKm, availability]
    );

    return res.json({
      results: result.rows,
      total_results: result.rows.length,
      radius_km: radiusKm,
      availability_filter: availability
    });
  } catch (err) {
    console.error('Product search error:', err);
    return res.status(500).json({ error: 'Unable to search nearby products.' });
  }
});

app.get('/api/search/suggestions', async (req, res) => {
  const { lat, lng, query = '' } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lng);
  const radiusValue = String(req.query.radius || '').trim();
  const requestedRadius = radiusValue ? Number(radiusValue) : null;
  const term = String(query).trim();

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (requestedRadius !== null && !Number.isFinite(requestedRadius))) {
    return res.status(400).json({ error: 'Valid latitude, longitude, and radius are required.' });
  }
  if (term.length < 2) return res.json({ suggestions: [] });

  try {
    const result = await pool.query(
      `
        WITH nearby_matches AS (
          SELECT p.name, p.brand,
            6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians($1)) * cos(radians(s.latitude)) *
              cos(radians(s.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(s.latitude))
            ))) AS distance_km
          FROM products p
          JOIN shops s ON s.id = p.shop_id
          WHERE p.availability_status = 'available'
            AND (p.name ILIKE $3 OR p.brand ILIKE $3)
        )
        SELECT name, brand, MIN(distance_km) AS distance_km
        FROM nearby_matches
        WHERE ($4::numeric IS NULL OR distance_km <= $4)
        GROUP BY name, brand
        ORDER BY distance_km ASC, name ASC
        LIMIT 8;
      `,
      [latitude, longitude, `%${term}%`, requestedRadius === null ? 1200 : Math.min(Math.max(requestedRadius, 1), 1200)]
    );
    return res.json({ suggestions: result.rows });
  } catch (err) {
    console.error('Search suggestions error:', err);
    return res.status(500).json({ error: 'Unable to load product suggestions.' });
  }
});

app.post('/api/product-requests', rateLimit(10, 60 * 60 * 1000), async (req, res) => {
  const { requested_product, customer_phone, latitude, longitude, radius_km } = req.body;
  const productName = String(requested_product || '').trim();
  const parsedLatitude = latitude === undefined ? null : Number(latitude);
  const parsedLongitude = longitude === undefined ? null : Number(longitude);
  const parsedRadius = radius_km === undefined ? null : Number(radius_km);

  if (productName.length < 2 || productName.length > 255) {
    return res.status(400).json({ error: 'Please enter a product name between 2 and 255 characters.' });
  }
  if (
    (parsedLatitude !== null && !Number.isFinite(parsedLatitude)) ||
    (parsedLongitude !== null && !Number.isFinite(parsedLongitude)) ||
    (parsedRadius !== null && (!Number.isFinite(parsedRadius) || parsedRadius <= 0))
  ) {
    return res.status(400).json({ error: 'Invalid request location details.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO product_requests
        (requested_product, customer_phone, latitude, longitude, radius_km)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, requested_product, created_at`,
      [productName, customer_phone?.trim() || null, parsedLatitude, parsedLongitude, parsedRadius]
    );
    return res.status(201).json({ message: 'Your product request has been recorded.', request: result.rows[0] });
  } catch (err) {
    console.error('Product request error:', err);
    return res.status(500).json({ error: 'Unable to save your product request.' });
  }
});

app.get('/api/admin/product-requests', authenticate, async (req, res) => {
  try {
    if (!(await isAdmin(req.user.userId))) {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }

    const [summaryResult, recentResult, shopsResult, requestMetricsResult, shopMetricsResult] = await Promise.all([
      pool.query(`
        SELECT
          requested_product,
          COUNT(*)::int AS request_count,
          MIN(created_at) AS first_requested_at,
          MAX(created_at) AS last_requested_at,
          COUNT(customer_phone)::int AS contactable_requests
        FROM product_requests
        GROUP BY requested_product
        ORDER BY request_count DESC, last_requested_at DESC
        LIMIT 20;
      `),
      pool.query(`
        SELECT id, requested_product, latitude, longitude, radius_km, status, created_at,
          CASE WHEN customer_phone IS NULL THEN NULL ELSE RIGHT(customer_phone, 4) END AS phone_last_four
        FROM product_requests
        ORDER BY created_at DESC
        LIMIT 50;
      `),
      pool.query(`
        SELECT id, name, category, address, is_open, is_verified, verified_at, updated_at
        FROM shops
        ORDER BY is_verified ASC, updated_at DESC
        LIMIT 50;
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_requests,
          COUNT(*) FILTER (WHERE status = 'new')::int AS new_requests,
          COUNT(*) FILTER (WHERE status = 'working')::int AS working_requests,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_requests,
          COUNT(customer_phone)::int AS contactable_requests
        FROM product_requests;
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_shops,
          COUNT(*) FILTER (WHERE is_verified = TRUE)::int AS verified_shops,
          COUNT(*) FILTER (WHERE is_verified = FALSE)::int AS pending_shops,
          COUNT(*) FILTER (WHERE is_open = TRUE)::int AS open_shops
        FROM shops;
      `)
    ]);

    return res.json({
      demand_summary: summaryResult.rows,
      recent_requests: recentResult.rows,
      shops: shopsResult.rows,
      metrics: {
        requests: requestMetricsResult.rows[0],
        shops: shopMetricsResult.rows[0]
      }
    });
  } catch (err) {
    console.error('Admin product requests error:', err);
    return res.status(500).json({ error: 'Unable to load product demand.' });
  }
});

app.patch('/api/admin/product-requests/:requestId', authenticate, async (req, res) => {
  const requestId = Number(req.params.requestId);
  const { status } = req.body;
  if (!requestId || !['new', 'working', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'A valid request status is required.' });
  }
  try {
    if (!(await isAdmin(req.user.userId))) return res.status(403).json({ error: 'Administrator access is required.' });
    const result = await pool.query('UPDATE product_requests SET status = $1 WHERE id = $2 RETURNING id, status', [status, requestId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product request not found.' });
    return res.json({ message: 'Request status updated.', request: result.rows[0] });
  } catch (err) {
    console.error('Product request status error:', err);
    return res.status(500).json({ error: 'Unable to update request status.' });
  }
});

app.patch('/api/admin/shops/:shopId/verification', authenticate, async (req, res) => {
  const shopId = Number(req.params.shopId);
  const { is_verified } = req.body;
  if (!shopId || typeof is_verified !== 'boolean') {
    return res.status(400).json({ error: 'A valid verification status is required.' });
  }

  try {
    if (!(await isAdmin(req.user.userId))) {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }
    const result = await pool.query(
      `UPDATE shops
       SET is_verified = $1, verified_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, is_verified, verified_at`,
      [is_verified, shopId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Shop not found.' });
    return res.json({ message: 'Shop verification updated.', shop: result.rows[0] });
  } catch (err) {
    console.error('Shop verification update error:', err);
    return res.status(500).json({ error: 'Unable to update shop verification.' });
  }
});

// ==========================================
// 9. LEGACY EXPLORE FEED
// ==========================================
const handleExploreOrNearby = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id as shop_id, 
        s.name as shop_name, 
        s.latitude, 
        s.longitude, 
        s.google_map_link,
        s.category,
        s.address,
        s.phone,
        s.whatsapp_number,
        s.opening_hours,
        s.is_open,
        s.open_status_updated_at,
        s.is_verified,
        s.verified_at,
        p.id as product_id, 
        p.name as product_name, 
        p.description,
        p.brand,
        p.price, 
        p.image_url,
        p.availability_status,
        p.availability_updated_at,
        p.updated_at AS catalog_updated_at
      FROM shops s
      LEFT JOIN products p ON s.id = p.shop_id
      ORDER BY s.id DESC, p.id DESC
    `;

    const result = await pool.query(query);

    const shopsMap = {};

    result.rows.forEach(row => {
      if (!shopsMap[row.shop_id]) {
        shopsMap[row.shop_id] = {
          id: row.shop_id,
          name: row.shop_name,
          latitude: row.latitude,
          longitude: row.longitude,
          google_map_link: row.google_map_link,
          category: row.category,
          address: row.address,
          phone: row.phone,
          whatsapp_number: row.whatsapp_number,
          opening_hours: row.opening_hours,
          is_open: row.is_open,
          open_status_updated_at: row.open_status_updated_at,
          is_verified: row.is_verified,
          verified_at: row.verified_at,
          products: []
        };
      }

      if (row.product_id) {
        shopsMap[row.shop_id].products.push({
          id: row.product_id,
          name: row.product_name,
          description: row.description,
          brand: row.brand,
          price: row.price,
          image_url: row.image_url,
          availability_status: row.availability_status,
          availability_updated_at: row.availability_updated_at,
          catalog_updated_at: row.catalog_updated_at
        });
      }
    });

    const shopsList = Object.values(shopsMap);
    return res.json({ shops: shopsList });

  } catch (err) {
    console.error('Explore/Nearby API Error:', err);
    return res.status(500).json({ error: 'Failed to fetch explore/nearby data.' });
  }
};

app.get('/api/explore', handleExploreOrNearby);
app.get('/api/shops/nearby-products', handleExploreOrNearby);

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({ error: `API Route Not Found: [${req.method}] ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`Backend Server running with PostgreSQL on http://localhost:${PORT}`);
});
