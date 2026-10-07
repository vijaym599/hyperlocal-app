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

test('password change verifies the current password and revokes all sessions', async () => {
  process.env.JWT_SECRET = 'account-test-secret';
  const hash = await bcrypt.hash('CurrentPass1', 4); const updates = [];
  const pool = { query: async (sql, values = []) => {
    if (sql.startsWith('SELECT password')) return { rows: [{ password: hash }] };
    if (sql.startsWith('UPDATE users SET password')) { updates.push(values); return { rows: [] }; }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  const app = express(); app.use(express.json()); mountAccount(app, pool, authenticate, () => (req, res, next) => next());
  await serverFor(app, async (base) => {
    const token = jwt.sign({ userId: 4 }, process.env.JWT_SECRET);
    const post = (body) => fetch(`${base}/api/account/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    assert.equal((await post({ current_password: 'wrong', new_password: 'NewPassword2' })).status, 401);
    assert.equal((await post({ current_password: 'CurrentPass1', new_password: 'short' })).status, 400);
    assert.equal((await post({ current_password: 'CurrentPass1', new_password: 'NewPassword2' })).status, 200);
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
