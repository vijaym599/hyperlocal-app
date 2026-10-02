const assert = require('node:assert/strict');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const { Pool } = require('../backend/node_modules/pg');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env'), quiet: true });
const { databaseConfig } = require('../backend/production');

const pool = new Pool(databaseConfig());
const requiredConstraints = [
  'users_user_type_check', 'users_phone_e164_check', 'users_phone_verification_check', 'users_auth_version_check',
  'shops_coordinates_check', 'shops_subscription_plan_check', 'shops_subscription_status_check',
  'shops_verification_check', 'products_price_nonnegative_check', 'product_requests_status_check',
  'product_requests_location_check', 'product_requests_radius_check',
];
const requiredIndexes = [
  'shops_one_per_owner_idx', 'shops_discovery_idx', 'products_shop_catalog_idx',
  'products_availability_shop_idx', 'product_requests_status_created_idx',
  'user_activities_shop_created_idx', 'referral_earnings_user_status_idx',
  'phone_verification_unconsumed_idx',
  'page_visits_date_idx', 'page_visits_page_date_idx',
];

(async () => {
  const client = await pool.connect();
  try {
    const constraints = new Set((await client.query(`SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace`)).rows.map((row) => row.conname));
    const indexes = new Set((await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`)).rows.map((row) => row.indexname));
    for (const name of requiredConstraints) assert.ok(constraints.has(name), `Missing constraint: ${name}`);
    for (const name of requiredIndexes) assert.ok(indexes.has(name), `Missing index: ${name}`);

    await client.query('BEGIN');
    const phone = `+9199${String(randomInt(0, 100000000)).padStart(8, '0')}`;
    const user = (await client.query(`INSERT INTO users(owner_name,phone,password,user_type,phone_verified,phone_verified_at)
      VALUES('Schema check',$1,'not-a-real-login-hash','shop_owner',TRUE,CURRENT_TIMESTAMP) RETURNING id`, [phone])).rows[0];
    const shop = (await client.query(`INSERT INTO shops(user_id,name,latitude,longitude,subscription_plan,payment_id)
      VALUES($1,'Schema check shop',13.08,80.27,'basic','SCHEMA-CHECK') RETURNING id`, [user.id])).rows[0];
    await client.query(`INSERT INTO products(shop_id,name,price,availability_status) VALUES($1,'Schema check product',0,'available')`, [shop.id]);
    await client.query(`INSERT INTO shop_offers(shop_id,title) VALUES($1,'Schema check offer')`, [shop.id]);
    await client.query(`INSERT INTO product_requests(requested_product,latitude,longitude,radius_km) VALUES('Schema check request',13.08,80.27,5)`);
    await client.query('SAVEPOINT invalid_data');
    try {
      await client.query(`INSERT INTO users(owner_name,phone,password,user_type) VALUES('Invalid','123','x','customer')`);
      assert.fail('Invalid phone unexpectedly passed the database constraint.');
    } catch (error) {
      assert.equal(error.code, '23514');
      await client.query('ROLLBACK TO SAVEPOINT invalid_data');
    }
    await client.query('ROLLBACK');
    console.log('Database schema verification passed; all check records were rolled back.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
