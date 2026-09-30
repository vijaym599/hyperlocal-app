const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Server thodangumpodhe Connection-ai sodhikka
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database Connection Error:', err.message);
  } else {
    console.log('PostgreSQL Database Connected Successfully!');
    release();
  }
});

// Database Tables Automatic Creation Logic
const initDb = async () => {
  try {
    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        owner_name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Shops Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Others',
        address TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        google_map_link TEXT,
        phone VARCHAR(30),
        whatsapp_number VARCHAR(30),
        opening_hours TEXT,
        is_open BOOLEAN NOT NULL DEFAULT TRUE,
        open_status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMP,
        subscription_plan VARCHAR(50) DEFAULT 'free',
        payment_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Products Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        brand VARCHAR(100),
        price NUMERIC(10, 2) NOT NULL,
        image_url TEXT,
        availability_status VARCHAR(20) NOT NULL DEFAULT 'available',
        availability_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT products_availability_status_check
          CHECK (availability_status IN ('available', 'low_stock', 'out_of_stock'))
      );
    `);

    // Customer demand is retained even when no nearby shop currently lists a product.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_requests (
        id SERIAL PRIMARY KEY,
        requested_product VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(30),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        radius_km NUMERIC(5, 2),
        status VARCHAR(30) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_reviews (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (shop_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS product_reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, user_id)
      );
    `);

    // Existing installations may have been created before these fields existed.
    // Each statement is idempotent: it only adds a missing column and never
    // deletes or rewrites existing shop or product records.
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

      ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Others',
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
        ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30),
        ADD COLUMN IF NOT EXISTS opening_hours TEXT,
        ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS open_status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
        ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) NOT NULL DEFAULT 'available',
        ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'products_availability_status_check'
        ) THEN
          ALTER TABLE products
            ADD CONSTRAINT products_availability_status_check
            CHECK (availability_status IN ('available', 'low_stock', 'out_of_stock'));
        END IF;
      END $$;
    `);

    console.log('PostgreSQL Tables Verified & Ready!');
  } catch (err) {
    console.error('Table Creation Error:', err.message);
  }
};

// App run aagumbodhu tables create aagum
initDb();

module.exports = pool;
