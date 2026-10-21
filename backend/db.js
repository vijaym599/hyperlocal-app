const { Pool } = require('pg');
require('dotenv').config();

const { databaseConfig } = require('./production');
const pool = new Pool(databaseConfig());
pool.on('error', (error) => console.error('Idle database connection error:', error.message));

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
        auth_version INTEGER NOT NULL DEFAULT 1,
        password_changed_at TIMESTAMP,
        phone_changed_at TIMESTAMPTZ,
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
        image_url TEXT,
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

    await pool.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS city VARCHAR(80)');
    await pool.query(`ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS subscription_months INTEGER,
      ADD COLUMN IF NOT EXISTS subscription_amount_paise INTEGER,
      ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;`);

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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        visitor_id UUID,
        action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('review', 'call', 'directions', 'view', 'whatsapp', 'product_view', 'favorite', 'share', 'search')),
        shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_activities_actor_check CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS user_activities_user_created_idx
        ON user_activities (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        request_id UUID NOT NULL,
        method VARCHAR(10) NOT NULL CHECK (method IN ('POST','PUT','PATCH','DELETE')),
        route_path VARCHAR(255) NOT NULL,
        status_code SMALLINT NOT NULL CHECK (status_code BETWEEN 200 AND 399),
        target_id VARCHAR(64),
        ip_address INET,
        user_agent VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_created_idx
        ON admin_audit_logs (actor_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
        ON admin_audit_logs (created_at DESC);

      CREATE TABLE IF NOT EXISTS shop_notifications (
        id BIGSERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        notification_type VARCHAR(40) NOT NULL DEFAULT 'renewal_reminder',
        title VARCHAR(120) NOT NULL,
        message TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS shop_notifications_shop_created_idx
        ON shop_notifications (shop_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS product_stock_alerts (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        notified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS product_stock_alerts_product_active_idx
        ON product_stock_alerts (product_id, active) WHERE active=TRUE;

      CREATE TABLE IF NOT EXISTS customer_notifications (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
        notification_type VARCHAR(40) NOT NULL DEFAULT 'stock_available',
        title VARCHAR(160) NOT NULL,
        message TEXT NOT NULL,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS customer_notifications_user_created_idx
        ON customer_notifications (user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS shop_subscription_queue (
        id BIGSERIAL PRIMARY KEY,
        shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        plan VARCHAR(50) NOT NULL,
        payment_id VARCHAR(255) NOT NULL UNIQUE,
        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
        term_days INTEGER NOT NULL CHECK (term_days > 0),
        status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','activated','cancelled')),
        payment_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMPTZ,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS shop_subscription_queue_shop_status_idx
        ON shop_subscription_queue (shop_id, status, created_at);
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
        ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS phone_changed_at TIMESTAMPTZ;

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
        ADD COLUMN IF NOT EXISTS image_url TEXT,
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

      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
        ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) NOT NULL DEFAULT 'available',
        ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      ALTER TABLE user_activities ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE user_activities ADD COLUMN IF NOT EXISTS visitor_id UUID;
      ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS user_activities_action_type_check;
      ALTER TABLE user_activities
        ADD CONSTRAINT user_activities_action_type_check
        CHECK (action_type IN ('review', 'call', 'directions', 'view', 'whatsapp', 'product_view', 'favorite', 'share', 'search'));

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_activities_actor_check'
        ) THEN
          ALTER TABLE user_activities
            ADD CONSTRAINT user_activities_actor_check
            CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL);
        END IF;
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

    await require('./referrals').initReferrals(pool);
    await require('./phoneVerification').initPhoneVerification(pool);
    await require('./analytics').initAnalytics(pool);
    await require('./subscriptionPromotions').initSubscriptionPromotions(pool);
    await require('./supportReports').initSupportReports(pool);
    await require('./schemaOptimization').optimizeSchema(pool);
    console.log('PostgreSQL Tables Verified & Ready!');
  } catch (err) {
    console.error('Table Creation Error:', err.message);
    throw err;
  }
};

module.exports = pool;
module.exports.initDb = initDb;
