const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcryptjs');
const { mountPhoneVerification } = require('../phoneVerification');

const phone = '+919876543210';

test('registered customers and shop owners can reset a password with a one-time OTP claim', async () => {
  const previous = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'test', PHONE_OTP_PROVIDER: 'development', DEVELOPMENT_OTP_CODE: '654321', JWT_SECRET: 'password-reset-test-secret' });
  const claims = new Map();
  const user = { id: 7, phone, password: await bcrypt.hash('OldPassword1', 4), authVersion: 1 };
  const pool = { query: async (sql, values = []) => {
    if (sql === 'SELECT id FROM users WHERE phone=$1') return { rows: values[0] === user.phone ? [{ id: user.id }] : [] };
    if (sql.startsWith('DELETE FROM phone_verification_claims')) return { rows: [] };
    if (sql.startsWith('INSERT INTO phone_verification_claims')) { claims.set(values[0], { phone: values[1], expiresAt: values[2], consumed: false }); return { rows: [] }; }
    if (sql.startsWith('WITH consumed')) {
      const claim = claims.get(values[0]);
      if (!claim || claim.phone !== values[1] || claim.consumed || claim.expiresAt <= new Date() || values[1] !== user.phone) return { rows: [] };
      claim.consumed = true; user.password = values[2]; user.authVersion += 1; return { rows: [{ id: user.id }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  const app = express(); app.use(express.json()); mountPhoneVerification(app, pool, () => (_req, _res, next) => next());
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const response = await fetch(`${base}/api/auth/password-reset/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { response, body: await response.json() };
  };
  try {
    const unknown = await post('start', { phone: '+919999999999' });
    assert.equal(unknown.response.status, 200);
    assert.equal(unknown.body.development_code, undefined);

    const started = await post('start', { phone });
    assert.equal(started.response.status, 200);
    assert.equal(started.body.development_code, '654321');
    assert.equal((await post('check', { phone, code: '000000' })).response.status, 400);

    const checked = await post('check', { phone, code: '654321' });
    assert.equal(checked.response.status, 200);
    assert.ok(checked.body.reset_token);
    const completed = await post('complete', { phone, reset_token: checked.body.reset_token, new_password: 'NewPassword2' });
    assert.equal(completed.response.status, 200);
    assert.equal(await bcrypt.compare('NewPassword2', user.password), true);
    assert.equal(user.authVersion, 2);
    assert.equal((await post('complete', { phone, reset_token: checked.body.reset_token, new_password: 'AnotherPass3' })).response.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
