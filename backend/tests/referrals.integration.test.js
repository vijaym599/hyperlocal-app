const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { databaseConfig } = require('../production');
const { initReferrals } = require('../referrals');
const { initPhoneVerification } = require('../phoneVerification');

test('PostgreSQL referral registration, admin review and concurrent redemption workflow', { skip: process.env.RUN_REFERRAL_DB_TESTS !== 'true' }, async () => {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const schema = 'nearbuy_referral_test_' + randomBytes(8).toString('hex');
  const control = new Pool(databaseConfig());
  let pool, server;
  try {
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ ...databaseConfig(), options: `-c search_path=${schema}`, max: 10 });
    await pool.query(`CREATE TABLE users (
      id SERIAL PRIMARY KEY,owner_name TEXT,phone VARCHAR(20) UNIQUE NOT NULL,email TEXT UNIQUE,
      password TEXT NOT NULL,user_type TEXT NOT NULL DEFAULT 'customer',is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,phone_verified_at TIMESTAMP,auth_version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE shops (id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id),name TEXT,
        category TEXT,address TEXT,latitude DOUBLE PRECISION,longitude DOUBLE PRECISION,google_map_link TEXT,
        phone TEXT,whatsapp_number TEXT,opening_hours TEXT,opening_time TIME,closing_time TIME,
        subscription_plan TEXT,payment_id TEXT,is_verified BOOLEAN DEFAULT FALSE,verified_at TIMESTAMP,
        subscription_status TEXT DEFAULT 'active',subscription_cancelled_at TIMESTAMP,updated_at TIMESTAMP,
        city VARCHAR(80),subscription_months INTEGER,subscription_amount_paise INTEGER,
        subscription_started_at TIMESTAMPTZ,subscription_ends_at TIMESTAMPTZ);
      INSERT INTO users(owner_name,phone,password,user_type,is_admin) VALUES
        ('Referrer','+919000000001','test','customer',FALSE),
        ('Admin','+919000000002','test','customer',TRUE),
        ('Other user','+919000000003','test','customer',FALSE);`);
    await initReferrals(pool);
    await initPhoneVerification(pool);
    // Initialization must be safe to repeat.
    await initReferrals(pool);
    require.cache[require.resolve('../db')] = { exports: pool };
    process.env.JWT_SECRET = 'referral-integration-secret';
    process.env.NODE_ENV = 'development';
    process.env.PHONE_OTP_PROVIDER = 'development';
    process.env.DEVELOPMENT_OTP_CODE = '123456';
    const { app } = require('../index');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, url, userId, body) => {
      const response = await fetch(base + url, { method, headers: {
        'Content-Type': 'application/json',
        ...(userId ? { Authorization: `Bearer ${jwt.sign({ userId, isAdmin: true }, process.env.JWT_SECRET)}` } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    const get = (url, userId = 1) => request('GET', url, userId);
    const post = (url, userId, body) => request('POST', url, userId, body);
    const patch = (url, body, userId = 2) => request('PATCH', url, userId, body);
    const summary = () => get('/api/referrals');
    assert.equal((await get('/api/referrals', null)).status, 401);
    assert.equal((await get('/api/admin/referrals', 1)).status, 403, 'forged JWT admin flag must not grant admin access');
    const first = await summary();
    const code = first.body.user.referral_code;
    assert.match(code, /^NB[A-F0-9]{24}$/);
    assert.equal((await summary()).body.user.referral_code, code);
    const verifyPhone = async (phone) => {
      const started = await post('/api/auth/phone-verification/start', null, { phone });
      assert.equal(started.status, 200);
      const checked = await post('/api/auth/phone-verification/check', null, { phone, code: '123456' });
      assert.equal(checked.status, 200);
      return checked.body.verification_token;
    };
    const signup = async (phone, referralCode = code, plan = 'pro') => {
      const verificationToken = await verifyPhone(phone);
      return post('/api/auth/register-shop', null, {
        owner_name: 'Shop owner', account_phone: phone, password: 'test-password', shop_name: 'Corner shop',
        latitude: 13.08, longitude: 80.27, selected_plan: plan, payment_id: 'MOCK_PAY_LOCAL', referral_code: referralCode,
        phone_verification_token: verificationToken, reward_paise: 99999999, user_id: 3,
      });
    };
    assert.equal((await post('/api/auth/register-shop', null, { account_phone: '+919000000099', password: 'test-password', shop_name: 'Unverified', selected_plan: 'pro', payment_id: 'MOCK_PAY_LOCAL', latitude: 13, longitude: 80 })).status, 403);
    assert.equal((await post('/api/auth/register-customer', null, { name: 'Unverified', phone: '+919000000020', password: 'test-password' })).status, 403);
    const customerVerification = await verifyPhone('+919000000020');
    const customer = await post('/api/auth/register-customer', null, { name: 'Verified customer', phone: '+919000000020', password: 'test-password', phone_verification_token: customerVerification });
    assert.equal(customer.status, 201);
    assert.equal(customer.body.user.phone_verified, true);
    assert.equal((await post('/api/auth/register-customer', null, { name: 'Reuse', phone: '+919000000020', password: 'test-password', phone_verification_token: customerVerification })).status, 403);
    const invalid = await signup('+919000000011', 'NB' + 'F'.repeat(24));
    assert.equal(invalid.status, 400);
    assert.equal((await pool.query('SELECT id FROM users WHERE phone=$1', ['+919000000011'])).rows.length, 0, 'invalid referral must roll back registration');
    const registered = await signup('+919000000010');
    assert.equal(registered.status, 201);
    const shopId = registered.body.shop.id;
    let info = (await summary()).body;
    assert.equal(info.wallet.unverified_paise, 3980);
    assert.equal(info.wallet.available_paise, 0);
    assert.equal(info.earnings[0].referred_shop_id, shopId);
    assert.equal(info.earnings[0].owner_phone, undefined, 'shop owner private account phone is admin-only');
    const earningId = info.earnings[0].id;
    const payout = { account_name: 'Referrer', upi_id: 'referrer@bank', amount_paise: 1, user_id: 3, status: 'paid' };
    assert.equal((await post('/api/referrals/redeem', 1, payout)).status, 400);
    const earningPath = `/api/admin/referrals/earnings/${earningId}`;
    assert.equal((await patch(earningPath, { action: 'verify', payment_reference: 'SUB-100' }, 1)).status, 403);
    assert.equal((await patch(earningPath, { action: 'verify', payment_reference: 'MOCK_PAY_123' })).status, 400);
    assert.equal((await patch(earningPath, { action: 'verify', payment_reference: 'SUB-100' })).status, 200);
    assert.equal((await patch(earningPath, { action: 'verify', payment_reference: 'SUB-101' })).status, 409);
    assert.equal((await summary()).body.wallet.available_paise, 3980);
    // Upgrading the referred shop must not alter or duplicate its first-payment reward.
    assert.equal((await patch(`/api/shops/${shopId}/subscription`, { action: 'change', plan: 'enterprise', payment_id: 'MOCK_PAY_UPGRADE' }, registered.body.user.id)).status, 200);
    info = (await summary()).body;
    assert.equal(info.earnings.length, 1);
    assert.equal(info.earnings[0].reward_paise, 3980);
    assert.equal(info.earnings[0].subscription_plan, 'pro');
    const simultaneous = await Promise.all(Array.from({ length: 6 }, () => post('/api/referrals/redeem', 1, payout)));
    assert.equal(simultaneous.filter((result) => result.status === 201).length, 1);
    assert.equal(simultaneous.filter((result) => result.status === 409).length, 5);
    let redemption = simultaneous.find((result) => result.status === 201).body.redemption;
    assert.equal(redemption.amount_paise, 3980, 'client cannot choose the amount or credited user');
    assert.equal(redemption.user_id, 1);
    assert.equal(redemption.status, 'pending');
    assert.equal((await get('/api/referrals', 3)).body.redemptions.length, 0);
    const admin = (await get('/api/admin/referrals', 2)).body;
    assert.equal(admin.redemptions[0].user_phone, '+919000000001');
    assert.equal(admin.redemptions[0].shops[0].shop_id, shopId);
    assert.equal(admin.earnings[0].owner_phone, '+919000000010');
    let redeemPath = `/api/admin/referrals/redemptions/${redemption.id}`;
    assert.equal((await patch(redeemPath, { action: 'paid', payment_reference: 'PAY-100' })).status, 409);
    const approvals = await Promise.all([patch(redeemPath, { action: 'approve' }), patch(redeemPath, { action: 'approve' })]);
    assert.deepEqual(approvals.map((result) => result.status).sort(), [200, 409]);
    info = (await summary()).body;
    assert.equal(info.wallet.available_paise, 0);
    assert.equal(info.wallet.reserved_paise, 3980);
    assert.equal(info.wallet.paid_paise, 0, 'approval cannot claim that money was transferred');
    assert.equal((await patch(redeemPath, { action: 'reject' })).status, 400);
    assert.equal((await patch(redeemPath, { action: 'reject', note: 'Correct the payout details.' })).status, 200);
    assert.equal((await summary()).body.wallet.available_paise, 3980);
    redemption = (await post('/api/referrals/redeem', 1, payout)).body.redemption;
    redeemPath = `/api/admin/referrals/redemptions/${redemption.id}`;
    assert.equal((await patch(redeemPath, { action: 'approve' })).status, 200);
    assert.equal((await patch(redeemPath, { action: 'paid', payment_reference: 'PAY-100' })).status, 200);
    assert.equal((await patch(redeemPath, { action: 'paid', payment_reference: 'PAY-101' })).status, 409);
    info = (await summary()).body;
    assert.equal(info.wallet.available_paise, 0);
    assert.equal(info.wallet.paid_paise, 3980);
    assert.equal((await post('/api/referrals/redeem', 1, payout)).status, 400);
    const secondShop = await signup('+919000000012', code, 'basic');
    assert.equal(secondShop.status, 201);
    const secondEarning = (await summary()).body.earnings[0];
    const secondPath = `/api/admin/referrals/earnings/${secondEarning.id}`;
    assert.equal((await patch(secondPath, { action: 'verify', payment_reference: 'SUB-100' })).status, 409, 'one subscription payment cannot verify two rewards');
    assert.equal((await patch(secondPath, { action: 'verify', payment_reference: 'SUB-200' })).status, 200);
    const next = (await post('/api/referrals/redeem', 1, payout)).body.redemption;
    const nextPath = `/api/admin/referrals/redemptions/${next.id}`;
    assert.equal((await patch(nextPath, { action: 'approve' })).status, 200);
    assert.equal((await patch(nextPath, { action: 'paid', payment_reference: 'PAY-100' })).status, 409, 'one transfer cannot pay two redemptions');
    assert.equal((await summary()).body.wallet.paid_paise, 3980, 'failed duplicate payment must roll back');
    assert.equal((await patch(nextPath, { action: 'paid', payment_reference: 'PAY-200' })).status, 200);
    assert.equal((await summary()).body.wallet.paid_paise, 4380);
    assert.equal((await get('/api/admin/referrals?page=0', 2)).status, 400);
    assert.equal((await patch('/api/admin/referrals/redemptions/999999', { action: 'approve' })).status, 404);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    // Only the unique test schema is removed; never touch the application's schema.
    assert.match(schema, /^nearbuy_referral_test_[a-f0-9]{16}$/);
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await control.end();
  }
});
