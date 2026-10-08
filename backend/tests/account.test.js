const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authenticate = require('../middleware/auth');
const { withAccountValidation } = require('../middleware/auth');
const { mountAccount } = require('../account');

async function serverFor(app, run) {
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('database-backed authentication rejects revoked sessions', async () => {
  process.env.JWT_SECRET = 'account-test-secret';
  const pool = { query: async () => ({ rows: [{ auth_version: 3 }] }) };
  const app = express(); app.get('/private', withAccountValidation(pool), (req, res) => res.json({ ok: true }));
  await serverFor(app, async (base) => {
    const request = (version) => fetch(`${base}/private`, { headers: { Authorization: `Bearer ${jwt.sign({ userId: 4, authVersion: version }, process.env.JWT_SECRET)}` } });
    assert.equal((await request(2)).status, 401);
    assert.equal((await request(3)).status, 200);
  });
});

test('password change requires the current password and a one-time SMS OTP', async () => {
  process.env.JWT_SECRET = 'account-test-secret';
  process.env.NODE_ENV = 'test'; process.env.PHONE_OTP_PROVIDER = 'development'; process.env.DEVELOPMENT_OTP_CODE = '654321';
  const hash = await bcrypt.hash('CurrentPass1', 4); const updates = []; const claims = new Map();
  const query = async (sql, values = []) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.startsWith('SELECT phone,password')) return { rows: [{ phone: '+919876543210', password: hash }] };
    if (sql.startsWith('SELECT phone FROM users')) return { rows: [{ phone: '+919876543210' }] };
    if (sql.startsWith('DELETE FROM phone_verification_claims')) return { rows: [] };
    if (sql.startsWith('INSERT INTO phone_verification_claims')) { claims.set(values[0], { phone: values[1], consumed: false }); return { rows: [] }; }
    if (sql.startsWith('UPDATE phone_verification_claims')) {
      const claim = claims.get(values[0]);
      if (!claim || claim.phone !== values[1] || claim.consumed) return { rows: [] };
      claim.consumed = true; return { rows: [{ id: values[0] }] };
    }
    if (sql.startsWith('UPDATE users SET password')) { updates.push(values); return { rows: [] }; }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const client = { query, release() {} };
  const pool = { query, connect: async () => client };
  const app = express(); app.use(express.json()); mountAccount(app, pool, authenticate, () => (req, res, next) => next());
  await serverFor(app, async (base) => {
    const token = jwt.sign({ userId: 4 }, process.env.JWT_SECRET);
    const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    assert.equal((await post('/api/account/password-verification/start', { current_password: 'wrong' })).status, 401);
    const started = await post('/api/account/password-verification/start', { current_password: 'CurrentPass1' });
    assert.equal(started.status, 200); assert.equal((await started.json()).development_code, '654321');
    assert.equal((await post('/api/account/password-verification/check', { code: '000000' })).status, 400);
    const checked = await post('/api/account/password-verification/check', { code: '654321' });
    const verification = await checked.json(); assert.ok(verification.verification_token);
    assert.equal((await post('/api/account/password', { current_password: 'CurrentPass1', new_password: 'short', password_verification_token: verification.verification_token })).status, 400);
    assert.equal((await post('/api/account/password', { current_password: 'CurrentPass1', new_password: 'NewPassword2' })).status, 403);
    assert.equal((await post('/api/account/password', { current_password: 'CurrentPass1', new_password: 'NewPassword2', password_verification_token: verification.verification_token })).status, 200);
    assert.equal((await post('/api/account/password', { current_password: 'CurrentPass1', new_password: 'AnotherPass3', password_verification_token: verification.verification_token })).status, 403);
    assert.equal(updates.length, 1);
    assert.equal(await bcrypt.compare('NewPassword2', updates[0][0]), true);
  });
});

test('phone change requires password and one-time verification then revokes every session', async () => {
  process.env.JWT_SECRET = 'account-test-secret';
  const passwordHash = await bcrypt.hash('CurrentPass1', 4);
  const updates = []; let verificationConsumed = false;
  const client = { release() {}, query: async (sql, values = []) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.includes('SELECT id,phone,password,phone_changed_at')) return { rows: [{ id: 4, phone: '+919876543210', password: passwordHash, phone_changed_at: null, phone_change_allowed: true }] };
    if (sql.startsWith('SELECT id FROM users WHERE phone=')) return { rows: [] };
    if (sql.startsWith('UPDATE phone_verification_claims')) {
      if (verificationConsumed) return { rows: [] };
      verificationConsumed = true; return { rows: [{ id: values[0] }] };
    }
    if (sql.startsWith('UPDATE users SET phone=')) { updates.push({ sql, values }); return { rows: [] }; }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  const pool = { connect: async () => client, query: (...args) => client.query(...args) };
  const app = express(); app.use(express.json()); mountAccount(app, pool, authenticate, () => (_req, _res, next) => next());
  const session = jwt.sign({ userId: 4 }, process.env.JWT_SECRET);
  const verification = jwt.sign({ purpose: 'phone_signup', phone: '+919876543211', jti: '11111111-1111-1111-1111-111111111111' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  await serverFor(app, async (base) => {
    const response = await fetch(`${base}/api/account/phone`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, body: JSON.stringify({ new_phone: '+919876543211', current_password: 'CurrentPass1', phone_verification_token: verification }) });
    assert.equal(response.status, 200);
    assert.equal(updates.length, 1); assert.deepEqual(updates[0].values, ['+919876543211', 4]);
    assert.match(updates[0].sql, /auth_version=auth_version\+1/);
  });
});
