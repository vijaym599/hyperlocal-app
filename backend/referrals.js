const { randomBytes } = require('node:crypto');

const PLAN_PRICES_PAISE = Object.freeze({ basic: 12000, pro: 19900, advance: 49900, enterprise: 99900 });
const validPhone = (phone) => /^\+?[1-9]\d{7,14}$/.test(String(phone || ''));
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const fail = (status, message) => Object.assign(new Error(message), { status });

async function initReferrals(pool) {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(26);
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users(referral_code);
    CREATE TABLE IF NOT EXISTS referral_earnings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
      referred_shop_id INTEGER NOT NULL UNIQUE,
      shop_name TEXT NOT NULL,
      owner_phone VARCHAR(20) NOT NULL,
      subscription_plan VARCHAR(50) NOT NULL,
      subscription_price_paise INTEGER NOT NULL CHECK(subscription_price_paise > 0),
      reward_paise INTEGER NOT NULL CHECK(reward_paise > 0 AND reward_paise * 5 = subscription_price_paise),
      status VARCHAR(30) NOT NULL DEFAULT 'pending_verification' CHECK(status IN ('pending_verification','available','rejected')),
      payment_reference TEXT UNIQUE,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS referral_earnings_user_idx ON referral_earnings(user_id);
    CREATE TABLE IF NOT EXISTS referral_redemptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
      account_name VARCHAR(120) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      upi_id VARCHAR(150) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paid')),
      reviewed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_at TIMESTAMPTZ,
      review_note TEXT,
      payment_reference TEXT UNIQUE,
      paid_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(status != 'paid' OR (payment_reference IS NOT NULL AND paid_at IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS referral_redemptions_user_idx ON referral_redemptions(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS referral_one_open_redemption ON referral_redemptions(user_id) WHERE status IN ('pending','approved');
    CREATE TABLE IF NOT EXISTS referral_redemption_items (
      redemption_id INTEGER NOT NULL REFERENCES referral_redemptions(id) ON DELETE RESTRICT,
      earning_id INTEGER NOT NULL REFERENCES referral_earnings(id) ON DELETE RESTRICT,
      PRIMARY KEY(redemption_id, earning_id)
    );
  `);
}

// Called inside the shop-registration transaction. Attribution is immutable.
async function attachReferral(client, code, shop, ownerPhone) {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  if (!/^NB[A-F0-9]{24}$/.test(normalized)) throw fail(400, 'Enter a valid referral code.');
  const { rows } = await client.query('SELECT id,phone,user_type,is_admin FROM users WHERE referral_code=$1', [normalized]);
  const referrer = rows[0];
  if (!referrer || referrer.user_type !== 'customer' || referrer.is_admin || !validPhone(referrer.phone)) throw fail(400, 'This referral code is not eligible.');
  if (referrer.id === shop.user_id || referrer.phone.replace(/^\+/, '') === ownerPhone.replace(/^\+/, '')) throw fail(400, 'You cannot refer your own shop.');
  const price = shop.subscription_amount_paise || PLAN_PRICES_PAISE[shop.subscription_plan];
  if (!price) throw fail(400, 'This subscription plan does not earn referral rewards.');
  await client.query(`INSERT INTO referral_earnings
    (user_id,shop_id,referred_shop_id,shop_name,owner_phone,subscription_plan,subscription_price_paise,reward_paise)
    VALUES($1,$2,$2,$3,$4,$5,$6,$7)`, [referrer.id, shop.id, shop.name, ownerPhone, shop.subscription_plan, price, price / 5]);
}

async function wallet(pool, userId) {
  const { rows } = await pool.query(`SELECT
    COALESCE((SELECT SUM(reward_paise) FROM referral_earnings WHERE user_id=$1 AND status='available'),0)::bigint AS earned_paise,
    COALESCE((SELECT SUM(reward_paise) FROM referral_earnings WHERE user_id=$1 AND status='pending_verification'),0)::bigint AS unverified_paise,
    COALESCE((SELECT SUM(amount_paise) FROM referral_redemptions WHERE user_id=$1 AND status IN ('pending','approved')),0)::bigint AS reserved_paise,
    COALESCE((SELECT SUM(amount_paise) FROM referral_redemptions WHERE user_id=$1 AND status='paid'),0)::bigint AS paid_paise`, [userId]);
  const result = Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
  result.available_paise = result.earned_paise - result.reserved_paise - result.paid_paise;
  return result;
}

async function transaction(pool, task) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await task(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function lockCustomer(client, userId) {
  const { rows } = await client.query('SELECT id,owner_name,phone,phone_verified,user_type,is_admin FROM users WHERE id=$1 FOR UPDATE', [userId]);
  if (!rows[0] || rows[0].user_type !== 'customer' || rows[0].is_admin) throw fail(403, 'Referral rewards are available to customer accounts.');
  return rows[0];
}

async function redeem(pool, userId, body = {}) {
  const accountName = String(body.account_name || '').trim();
  const upiId = String(body.upi_id || '').trim().toLowerCase();
  if (accountName.length < 2 || accountName.length > 120 || !/^[a-z0-9._-]{2,100}@[a-z][a-z0-9.-]{1,48}$/.test(upiId)) throw fail(400, 'Enter the account holder name and a valid UPI ID.');
  return transaction(pool, async (client) => {
    const user = await lockCustomer(client, userId);
    if (!validPhone(user.phone)) throw fail(400, 'A valid account phone number is required to redeem.');
    const open = await client.query("SELECT id FROM referral_redemptions WHERE user_id=$1 AND status IN ('pending','approved')", [userId]);
    if (open.rows.length) throw fail(409, 'You already have a redemption awaiting review or payment.');
    const balance = await wallet(client, userId);
    if (balance.available_paise <= 0) throw fail(400, 'No verified referral balance is available to redeem.');
    const { rows } = await client.query(`INSERT INTO referral_redemptions(user_id,amount_paise,account_name,phone,upi_id)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [userId, balance.available_paise, accountName, user.phone, upiId]);
    await client.query(`INSERT INTO referral_redemption_items(redemption_id,earning_id)
      SELECT $1,e.id FROM referral_earnings e WHERE e.user_id=$2 AND e.status='available'
      AND NOT EXISTS(SELECT 1 FROM referral_redemption_items i JOIN referral_redemptions r ON r.id=i.redemption_id
        WHERE i.earning_id=e.id AND r.status IN ('pending','approved','paid'))`, [rows[0].id, userId]);
    return rows[0];
  });
}

async function reviewEarning(pool, adminId, id, body = {}) {
  if (!['verify','reject'].includes(body.action)) throw fail(400, 'Choose verify or reject.');
  const reference = String(body.payment_reference || '').trim();
  const note = String(body.note || '').trim();
  if (note.length > 500 || (body.action === 'verify' && (reference.length < 3 || reference.length > 150 || /^MOCK|DEMO/i.test(reference)))) throw fail(400, 'Verification needs a real subscription payment reference.');
  if (body.action === 'reject' && !note) throw fail(400, 'Provide a reason for rejecting the referral.');
  return transaction(pool, async (client) => {
    const owner = (await client.query('SELECT user_id FROM referral_earnings WHERE id=$1', [id])).rows[0];
    if (!owner) throw fail(404, 'Referral not found.');
    await lockCustomer(client, owner.user_id);
    const earning = (await client.query('SELECT * FROM referral_earnings WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (earning.status !== 'pending_verification') throw fail(409, 'This referral has already been reviewed.');
    if (body.action === 'verify' && !earning.shop_id) throw fail(409, 'The referred shop no longer exists.');
    return (await client.query(`UPDATE referral_earnings SET status=$2,payment_reference=$3,review_note=$4,reviewed_by=$5,reviewed_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
      [id, body.action === 'verify' ? 'available' : 'rejected', body.action === 'verify' ? reference : null, note || null, adminId])).rows[0];
  });
}

async function reviewRedemption(pool, adminId, id, body = {}) {
  if (!['approve','reject','paid'].includes(body.action)) throw fail(400, 'Choose approve, reject or paid.');
  const note = String(body.note || '').trim();
  const reference = String(body.payment_reference || '').trim();
  if (note.length > 500) throw fail(400, 'Review note must be at most 500 characters.');
  if (body.action === 'reject' && !note) throw fail(400, 'Provide a rejection reason.');
  if (body.action === 'paid' && (reference.length < 3 || reference.length > 150 || /^MOCK|DEMO/i.test(reference))) throw fail(400, 'Enter the actual completed transfer reference.');
  return transaction(pool, async (client) => {
    const owner = (await client.query('SELECT user_id FROM referral_redemptions WHERE id=$1', [id])).rows[0];
    if (!owner) throw fail(404, 'Redemption not found.');
    const user = await lockCustomer(client, owner.user_id);
    const request = (await client.query('SELECT * FROM referral_redemptions WHERE id=$1 FOR UPDATE', [id])).rows[0];
    const allowed = body.action === 'paid' ? request.status === 'approved'
      : body.action === 'approve' ? request.status === 'pending' : ['pending','approved'].includes(request.status);
    if (!allowed) throw fail(409, 'This redemption cannot make that status change.');
    if (body.action === 'approve' && !validPhone(user.phone)) throw fail(400, 'The user needs a valid account phone.');
    if (body.action === 'paid') return (await client.query(`UPDATE referral_redemptions SET status='paid',payment_reference=$2,paid_by=$3,paid_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id, reference, adminId])).rows[0];
    return (await client.query(`UPDATE referral_redemptions SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id, body.action === 'approve' ? 'approved' : 'rejected', note || null, adminId])).rows[0];
  });
}

function mountReferrals(app, pool, authenticate) {
  const handler = (task) => async (req, res) => {
    try { await task(req, res); }
    catch (error) {
      if (!error.status && error.code !== '23505') console.error('Referral operation failed:', error.message);
      res.status(error.status || (error.code === '23505' ? 409 : 500)).json({ error: error.status ? error.message : error.code === '23505' ? 'This payment reference or request has already been used.' : 'Unable to process referral operation. Please try again.' });
    }
  };
  const customer = handler(async (req, res) => {
    const user = (await pool.query('SELECT user_type,is_admin FROM users WHERE id=$1', [req.user.userId])).rows[0];
    if (!user || user.user_type !== 'customer' || user.is_admin) throw fail(403, 'Customer access required.');
    req.referralAccess = true;
  });
  // Explicit database role checks; never trust token role claims.
  const customerAccess = async (req, res, next) => { await customer(req, res); if (req.referralAccess) next(); };
  const adminAccess = handler(async (req, res) => {
    const user = (await pool.query('SELECT is_admin FROM users WHERE id=$1', [req.user.userId])).rows[0];
    if (!user?.is_admin) throw fail(403, 'Administrator access required.');
    req.referralAccess = true;
  });
  const admin = async (req, res, next) => { await adminAccess(req, res); if (req.referralAccess) next(); };

  app.get('/api/referrals', authenticate, customerAccess, handler(async (req, res) => {
    const user = (await pool.query(`UPDATE users SET referral_code=COALESCE(referral_code,$2) WHERE id=$1 RETURNING id,owner_name,phone,phone_verified,referral_code`, [req.user.userId, 'NB' + randomBytes(12).toString('hex').toUpperCase()])).rows[0];
    const earnings = (await pool.query('SELECT id,referred_shop_id,shop_name,subscription_plan,subscription_price_paise,reward_paise,status,review_note,created_at FROM referral_earnings WHERE user_id=$1 ORDER BY created_at DESC,id DESC', [user.id])).rows;
    const redemptions = (await pool.query('SELECT * FROM referral_redemptions WHERE user_id=$1 ORDER BY created_at DESC,id DESC', [user.id])).rows;
    res.set('Cache-Control', 'no-store').json({ user, wallet: await wallet(pool, user.id), earnings, redemptions });
  }));
  app.post('/api/referrals/redeem', authenticate, customerAccess, handler(async (req, res) => res.status(201).json({ redemption: await redeem(pool, req.user.userId, req.body) })));
  app.get('/api/admin/referrals', authenticate, admin, handler(async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw fail(400, 'Enter a valid page.');
    const offset = (page - 1) * 100;
    const earnings = (await pool.query(`SELECT e.*,u.owner_name AS user_name,u.phone AS user_phone,u.phone_verified,u.user_type FROM referral_earnings e JOIN users u ON u.id=e.user_id ORDER BY (e.status='pending_verification') DESC,e.created_at DESC,e.id DESC LIMIT 101 OFFSET $1`, [offset])).rows;
    const redemptions = (await pool.query(`SELECT r.*,u.owner_name AS user_name,u.phone AS user_phone,u.phone_verified,
      COALESCE((SELECT json_agg(json_build_object('shop_id',e.referred_shop_id,'shop_name',e.shop_name,'subscription_plan',e.subscription_plan,'reward_paise',e.reward_paise))
        FROM referral_redemption_items i JOIN referral_earnings e ON e.id=i.earning_id WHERE i.redemption_id=r.id),'[]'::json) AS shops
      FROM referral_redemptions r JOIN users u ON u.id=r.user_id ORDER BY (r.status IN ('pending','approved')) DESC,r.created_at DESC,r.id DESC LIMIT 101 OFFSET $1`, [offset])).rows;
    res.set('Cache-Control', 'no-store').json({ earnings: earnings.slice(0,100), redemptions: redemptions.slice(0,100), page, has_more: earnings.length > 100 || redemptions.length > 100 });
  }));
  const id = (req) => {
    const value = Number(req.params.id);
    if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw fail(400, 'A valid record ID is required.');
    return value;
  };
  app.patch('/api/admin/referrals/earnings/:id', authenticate, admin, handler(async (req, res) => res.json({ earning: await reviewEarning(pool, req.user.userId, id(req), req.body) })));
  app.patch('/api/admin/referrals/redemptions/:id', authenticate, admin, handler(async (req, res) => res.json({ redemption: await reviewRedemption(pool, req.user.userId, id(req), req.body) })));
}

module.exports = { PLAN_PRICES_PAISE, initReferrals, attachReferral, wallet, redeem, reviewEarning, reviewRedemption, mountReferrals };
