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
