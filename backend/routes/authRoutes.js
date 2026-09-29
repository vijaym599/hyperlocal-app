const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// REGISTER SHOP
router.post('/register-shop', async (req, res) => {
  const { owner_name, email, password, shop_name, latitude, longitude, selected_plan } = req.body;

  try {
    if (!email || !password || !shop_name || !owner_name) {
      return res.status(400).json({ error: "அனைத்து முக்கிய விவரங்களையும் நிரப்பவும்." });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingShop = await db.query('SELECT id FROM shops WHERE LOWER(email) = $1', [cleanEmail]);
    if (existingShop.rows && existingShop.rows.length > 0) {
      return res.status(400).json({ error: "இந்த Email ID ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO shops (owner_name, email, password, shop_name, latitude, longitude, subscription_plan)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, owner_name, email, shop_name, latitude, longitude, subscription_plan;
    `;

    const values = [
      owner_name,
      cleanEmail,
      hashedPassword,
      shop_name,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      selected_plan || 'free'
    ];

    const result = await db.query(insertQuery, values);
    const newShop = result.rows[0];

    const token = jwt.sign(
      { shopId: newShop.id, email: newShop.email },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: "Shop registered successfully!",
      token,
      user: { id: newShop.id, name: newShop.owner_name, email: newShop.email },
      shop: newShop
    });

  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// LOGIN SHOP
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) return res.status(400).json({ error: "Email & Password தேவை." });

    const cleanEmail = email.toLowerCase().trim();
    const result = await db.query('SELECT * FROM shops WHERE LOWER(email) = $1', [cleanEmail]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ error: "இந்த Email பதிவு செய்யப்படவில்லை." });
    }

    const shop = result.rows[0];
    const isMatch = await bcrypt.compare(password, shop.password);
    if (!isMatch) return res.status(400).json({ error: "கடவுச்சொல் தவறானது." });

    const token = jwt.sign(
      { shopId: shop.id, email: shop.email },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: shop.id, name: shop.owner_name, email: shop.email },
      shop
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;