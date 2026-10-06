async function optimizeSchema(pool) {
  await pool.query(`
    ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
    ALTER TABLE users ALTER COLUMN user_type SET NOT NULL;
    ALTER TABLE shops ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE shops ALTER COLUMN subscription_plan SET DEFAULT 'basic';
    ALTER TABLE products ALTER COLUMN shop_id SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS shops_one_per_owner_idx ON shops(user_id);
    CREATE INDEX IF NOT EXISTS shops_discovery_idx ON shops(category,is_open,id);
    CREATE INDEX IF NOT EXISTS shops_admin_queue_idx ON shops(is_verified,updated_at DESC);
    CREATE INDEX IF NOT EXISTS shops_subscription_expiry_idx ON shops(subscription_ends_at,id) WHERE subscription_ends_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS products_shop_catalog_idx ON products(shop_id,name,id);
    CREATE INDEX IF NOT EXISTS products_availability_shop_idx ON products(availability_status,shop_id);
    CREATE INDEX IF NOT EXISTS product_requests_status_created_idx ON product_requests(status,created_at DESC);
    CREATE INDEX IF NOT EXISTS product_requests_created_idx ON product_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS shop_reviews_recent_idx ON shop_reviews(shop_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS product_reviews_recent_idx ON product_reviews(product_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS user_activities_shop_created_idx ON user_activities(shop_id,created_at DESC) WHERE shop_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS user_activities_product_created_idx ON user_activities(product_id,created_at DESC) WHERE product_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS referral_earnings_user_status_idx ON referral_earnings(user_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS referral_redemptions_user_status_idx ON referral_redemptions(user_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS referral_redemption_items_earning_idx ON referral_redemption_items(earning_id);
    CREATE INDEX IF NOT EXISTS phone_verification_unconsumed_idx ON phone_verification_claims(phone,expires_at DESC) WHERE consumed_at IS NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_user_type_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_user_type_check CHECK(user_type IN ('customer','shop_owner'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_phone_e164_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_phone_e164_check CHECK(phone ~ '^\\+[1-9][0-9]{7,14}$');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_phone_verification_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_phone_verification_check CHECK(NOT phone_verified OR phone_verified_at IS NOT NULL);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_auth_version_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_auth_version_check CHECK(auth_version >= 1);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shops_coordinates_check') THEN
        ALTER TABLE shops ADD CONSTRAINT shops_coordinates_check CHECK(latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shops_subscription_plan_check') THEN
        ALTER TABLE shops ADD CONSTRAINT shops_subscription_plan_check CHECK(subscription_plan IN ('basic','pro','advance','enterprise'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shops_subscription_status_check') THEN
        ALTER TABLE shops ADD CONSTRAINT shops_subscription_status_check CHECK(subscription_status IN ('active','cancelled'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shops_verification_check') THEN
        ALTER TABLE shops ADD CONSTRAINT shops_verification_check CHECK((is_verified AND verified_at IS NOT NULL) OR (NOT is_verified AND verified_at IS NULL));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_price_nonnegative_check') THEN
        ALTER TABLE products ADD CONSTRAINT products_price_nonnegative_check CHECK(price >= 0);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_requests_status_check') THEN
        ALTER TABLE product_requests ADD CONSTRAINT product_requests_status_check CHECK(status IN ('new','working','resolved'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_requests_location_check') THEN
        ALTER TABLE product_requests ADD CONSTRAINT product_requests_location_check CHECK(
          (latitude IS NULL AND longitude IS NULL) OR
          (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
        );
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_requests_radius_check') THEN
        ALTER TABLE product_requests ADD CONSTRAINT product_requests_radius_check CHECK(radius_km IS NULL OR radius_km > 0);
      END IF;
    END $$;
  `);
}

module.exports = { optimizeSchema };
