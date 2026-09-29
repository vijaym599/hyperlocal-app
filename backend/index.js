const express = require('express');
const cors = require('cors');
const pool = require('./db');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/products', productRoutes);

const SUBSCRIPTION_LIMITS = {
  free: 10,
  basic: 50,
  pro: 200,
  advance: 500,
  enterprise: 999999
};

// ==========================================
// 1. REGISTER SHOP & USER (PostgreSQL)
// ==========================================
app.post('/api/auth/register-shop', async (req, res) => {
  try {
    const { 
      owner_name, 
      email, 
      password, 
      shop_name, 
      latitude, 
      longitude, 
      google_map_link, 
      selected_plan, 
      payment_id 
    } = req.body;

    console.log("Registration Payload Received:", req.body);

    if (!email || !password || !shop_name) {
      return res.status(400).json({ error: 'Email, Password, and Shop Name are required!' });
    }

    // 1. Email Check
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'This Email is already registered!' });
    }

    // 2. Insert User
    const userResult = await pool.query(
      `INSERT INTO users (owner_name, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, owner_name`,
      [owner_name || '', email, password]
    );

    const newUser = userResult.rows[0];

    // Safe Lat/Lng Parse
    const lat = latitude ? parseFloat(latitude) : 0;
    const lng = longitude ? parseFloat(longitude) : 0;

    // 3. Insert Shop
    const shopResult = await pool.query(
      `INSERT INTO shops (user_id, name, latitude, longitude, google_map_link, subscription_plan, payment_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        newUser.id,
        shop_name,
        lat,
        lng,
        google_map_link || '',
        selected_plan || 'free',
        payment_id || null
      ]
    );

    const newShop = shopResult.rows[0];

    console.log("Shop registered successfully:", newShop);

    return res.status(201).json({
      message: 'Shop created successfully',
      token: `auth_token_${newUser.id}`,
      user: newUser,
      shop: newShop
    });

  } catch (err) {
    console.error("Register Error in Backend:", err.message);
    return res.status(500).json({ error: 'Database/Server Error: ' + err.message });
  }
});

// ==========================================
// 2. LOGIN API (PostgreSQL)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and Password missing!' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Email ID or Password!' });
    }

    const user = userRes.rows[0];
    const shopRes = await pool.query('SELECT * FROM shops WHERE user_id = $1', [user.id]);
    const shop = shopRes.rows[0] || null;

    return res.json({
      message: 'Login successful!',
      token: `auth_token_${user.id}`,
      user: { id: user.id, email: user.email, owner_name: user.owner_name },
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

// ==========================================
// 4. ADD PRODUCT (PostgreSQL)
// ==========================================
app.post('/api/shops/:shopId/products', async (req, res) => {
  const shopId = Number(req.params.shopId);
  const { name, price, image_url } = req.body;

  if (!shopId) return res.status(400).json({ error: 'Invalid Shop ID!' });
  if (!name || !price) return res.status(400).json({ error: 'Product name and price required!' });

  try {
    // Check Shop
    const shopRes = await pool.query('SELECT * FROM shops WHERE id = $1', [shopId]);
    if (shopRes.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found in PostgreSQL Database!' });
    }
    const shop = shopRes.rows[0];

    // Check Limit
    const countRes = await pool.query('SELECT COUNT(*) FROM products WHERE shop_id = $1', [shopId]);
    const productCount = parseInt(countRes.rows[0].count);
    const planLimit = SUBSCRIPTION_LIMITS[shop.subscription_plan] || 10;

    if (productCount >= planLimit) {
      return res.status(400).json({ error: `Limit reached! Your current plan allows only ${planLimit} products.` });
    }

    const defaultImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300';
    const prodImg = (image_url && image_url.trim() !== '') ? image_url : defaultImg;

    const newProductRes = await pool.query(
      'INSERT INTO products (shop_id, name, price, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [shopId, name, parseFloat(price), prodImg]
    );

    return res.status(201).json({ message: 'Product added successfully!', product: newProductRes.rows[0] });

  } catch (err) {
    console.error('Add Product Error:', err);
    return res.status(500).json({ error: 'Failed to insert product.' });
  }
});

// ==========================================
// 5. EDIT / UPDATE PRODUCT (FIXED for PostgreSQL)
// ==========================================
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, image_url } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Product name and price are required!' });
  }

  try {
    const defaultImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300';
    const prodImg = (image_url && image_url.trim() !== '') ? image_url : defaultImg;

    const sql = `
      UPDATE products 
      SET name = $1, price = $2, image_url = $3 
      WHERE id = $4 
      RETURNING *
    `;

    const result = await pool.query(sql, [name, parseFloat(price), prodImg, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found!' });
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

// ==========================================
// 7. FETCH ALL NEARBY SHOPS & PRODUCTS
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
        p.id as product_id, 
        p.name as product_name, 
        p.price, 
        p.image_url
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
          products: []
        };
      }

      if (row.product_id) {
        shopsMap[row.shop_id].products.push({
          id: row.product_id,
          name: row.product_name,
          price: row.price,
          image_url: row.image_url
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