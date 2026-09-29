const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/auth');

// ==========================================
// 1. SHOP REGISTER ROUTE
// ==========================================
router.post('/register', authenticate, async (req, res) => {
  const { shop_name, address, google_map_link, latitude, longitude, image_url } = req.body;
  const owner_id = req.user.userId;

  if (!owner_id || !shop_name || !address || !latitude || !longitude) {
    return res.status(400).json({ error: 'தேவையான அனைத்து விவரங்களையும் வழங்கவும்.' });
  }

  try {
    // Latitude & Longitude மற்றும் PostGIS Location இரண்டிலுமே Save செய்ய விரும்பினால்:
    const insertShopQuery = `
      INSERT INTO shops (owner_id, shop_name, address, google_map_link, latitude, longitude, location, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326), $7)
      RETURNING id, owner_id, shop_name, address, google_map_link, latitude, longitude, image_url;
    `;

    const shopResult = await pool.query(insertShopQuery, [
      owner_id,
      shop_name,
      address,
      google_map_link || null,
      parseFloat(latitude),
      parseFloat(longitude),
      image_url || null
    ]);

    res.status(201).json({
      message: 'கடை வெற்றிகரமாக பதிவு செய்யப்பட்டது!',
      shop: shopResult.rows[0]
    });
  } catch (err) {
    console.error('Register Shop Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. NEARBY PRODUCTS & SHOPS API (For NearbySearch.jsx)
// ==========================================
router.get('/nearby-products', async (req, res) => {
  const { lat, lng, radius } = req.query;
  const searchRadiusKM = radius ? parseFloat(radius) : 10; // Default 10 KM

  try {
    let query = '';
    let params = [];

    if (lat && lng) {
      // User GPS Location இருக்கும்போது PostGIS Distance கணக்கிடுதல்
      query = `
        SELECT 
          s.id,
          s.shop_name AS name,
          s.address,
          s.google_map_link,
          s.image_url,
          s.category,
          COALESCE(s.latitude, ST_Y(s.location::geometry)) AS latitude,
          COALESCE(s.longitude, ST_X(s.location::geometry)) AS longitude,
          ROUND((ST_Distance(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 2) AS distance,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.product_name,
                'price', p.price,
                'description', p.description,
                'image_url', p.image_url,
                'category', p.category
              )
            ) FILTER (WHERE p.id IS NOT NULL), '[]'
          ) AS products
        FROM shops s
        LEFT JOIN products p ON s.id = p.shop_id
        WHERE ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
        GROUP BY s.id
        ORDER BY distance ASC;
      `;
      params = [parseFloat(lng), parseFloat(lat), searchRadiusKM];
    } else {
      // User Location இல்லாதபோது
      query = `
        SELECT 
          s.id,
          s.shop_name AS name,
          s.address,
          s.google_map_link,
          s.image_url,
          s.category,
          COALESCE(s.latitude, ST_Y(s.location::geometry)) AS latitude,
          COALESCE(s.longitude, ST_X(s.location::geometry)) AS longitude,
          NULL AS distance,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.product_name,
                'price', p.price,
                'description', p.description,
                'image_url', p.image_url,
                'category', p.category
              )
            ) FILTER (WHERE p.id IS NOT NULL), '[]'
          ) AS products
        FROM shops s
        LEFT JOIN products p ON s.id = p.shop_id
        GROUP BY s.id;
      `;
    }

    const result = await pool.query(query, params);

    res.status(200).json({
      shops: result.rows
    });

  } catch (err) {
    console.error('PostGIS Nearby Products Fetch Error:', err.message);
    res.status(500).json({ error: 'கடைகளின் விவரங்களைப் பெறுவதில் பிழை: ' + err.message });
  }
});

// ==========================================
// 3. NEAR-BY GEOSPATIAL SEARCH API
// ==========================================
router.get('/search-nearby', async (req, res) => {
  const { lat, lng, query, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ 
      error: 'வாடிக்கையாளரின் இருப்பிடத்தை அறிய lat (Latitude) மற்றும் lng (Longitude) கட்டாயம் தேவை.' 
    });
  }

  const searchRadiusInKM = radius ? parseFloat(radius) : 10;
  const searchQuery = query ? `%${query}%` : null;

  try {
    const searchSql = `
      SELECT 
        p.id AS product_id,
        p.product_name,
        p.description,
        p.price,
        p.image_url AS product_image,
        s.id AS shop_id,
        s.shop_name,
        s.address,
        s.google_map_link,
        COALESCE(s.latitude, ST_Y(s.location::geometry)) AS latitude,
        COALESCE(s.longitude, ST_X(s.location::geometry)) AS longitude,
        ROUND((ST_Distance(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 2) AS distance_km
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      WHERE ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
        AND ($4::text IS NULL OR p.product_name ILIKE $4 OR s.shop_name ILIKE $4)
      ORDER BY distance_km ASC;
    `;

    const result = await pool.query(searchSql, [
      parseFloat(lng),
      parseFloat(lat),
      searchRadiusInKM,
      searchQuery
    ]);

    res.status(200).json({
      message: 'அருகில் உள்ள பொருட்கள் மற்றும் கடைகள் வெற்றிகரமாக பெறப்பட்டன!',
      total_results: result.rows.length,
      search_radius_km: searchRadiusInKM,
      results: result.rows
    });

  } catch (err) {
    console.error('Geospatial Search Error:', err.message);
    res.status(500).json({ error: 'தேடுதலில் பிழை ஏற்பட்டது: ' + err.message });
  }
});

module.exports = router;