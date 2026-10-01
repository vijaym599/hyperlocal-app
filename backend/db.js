const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Database Tables Automatic Creation Logic
const initDb = async () => {
  try {
    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        owner_name VARCHAR(255),
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
        phone_verified_at TIMESTAMP,
        user_type VARCHAR(20) NOT NULL DEFAULT 'customer',
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
        opening_time TIME,
        closing_time TIME,
        is_open BOOLEAN NOT NULL DEFAULT TRUE,
        open_status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verified_at TIMESTAMP,
        subscription_plan VARCHAR(50) DEFAULT 'free',
        subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
        subscription_cancelled_at TIMESTAMP,
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

      CREATE TABLE IF NOT EXISTS shop_offers (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        title VARCHAR(120) NOT NULL,
        description TEXT,
        discount_text VARCHAR(80),
        valid_until DATE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS shop_offers_active_idx
        ON shop_offers (is_active, valid_until, created_at DESC);
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

      CREATE TABLE IF NOT EXISTS user_activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('review', 'call', 'directions', 'view', 'whatsapp')),
        shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS user_activities_user_created_idx
        ON user_activities (user_id, created_at DESC);
    `);

    // Existing installations may have been created before these fields existed.
    // Each statement is idempotent: it only adds a missing column and never
    // deletes or rewrites existing shop or product records.
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'customer',
        ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;

      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
        ON users (phone) WHERE phone IS NOT NULL;

      UPDATE users u
      SET user_type = 'shop_owner'
      WHERE user_type = 'customer'
        AND EXISTS (SELECT 1 FROM shops s WHERE s.user_id = u.id);

      ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Others',
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
        ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30),
        ADD COLUMN IF NOT EXISTS opening_hours TEXT,
        ADD COLUMN IF NOT EXISTS opening_time TIME,
        ADD COLUMN IF NOT EXISTS closing_time TIME,
        ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS open_status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE shops
        ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMP;

      -- Bring existing paid shops in line with the Pro-and-above verified-badge benefit.
      UPDATE shops
      SET is_verified = TRUE,
          verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP)
      WHERE subscription_plan IN ('pro', 'advance', 'enterprise')
        AND payment_id IS NOT NULL
        AND is_verified = FALSE;

      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
        ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) NOT NULL DEFAULT 'available',
        ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS user_activities_action_type_check;
      ALTER TABLE user_activities
        ADD CONSTRAINT user_activities_action_type_check
        CHECK (action_type IN ('review', 'call', 'directions', 'view', 'whatsapp'));

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
    throw err;
  }
};

module.exports = pool;
module.exports.initDb = initDb;
