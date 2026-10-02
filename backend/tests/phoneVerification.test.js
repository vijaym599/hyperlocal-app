const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { normalizePhone, providerConfig, startVerification, checkVerification, issueVerificationToken, consumeVerificationToken } = require('../phoneVerification');

const dev = { NODE_ENV: 'test', PHONE_OTP_PROVIDER: 'development', DEVELOPMENT_OTP_CODE: '654321', JWT_SECRET: 'phone-verification-test-secret' };

test('Indian phone formats normalize to one E.164 identity and development OTP is local-only', async () => {
  assert.equal(normalizePhone('9876543210'), '+919876543210');
  assert.equal(normalizePhone('09876 543 210'), '+919876543210');
  assert.equal(normalizePhone('91-98765-43210'), '+919876543210');
  assert.equal(normalizePhone('+91 98765 43210'), '+919876543210');
  assert.equal((await startVerification('+919876543210', dev)).developmentCode, '654321');
  assert.equal((await startVerification('9876543210', dev)).phone, '+919876543210');
  assert.equal(await checkVerification('+919876543210', '654321', dev), true);
  assert.equal(await checkVerification('+919876543210', '000000', dev), false);
  await assert.rejects(() => startVerification('12345', dev), { status: 400 });
  assert.throws(() => providerConfig({ ...dev, NODE_ENV: 'production' }), { status: 503 });
  assert.throws(() => providerConfig({ NODE_ENV: 'production', PHONE_OTP_PROVIDER: 'twilio' }), { status: 503 });
});

test('verified signup tokens are phone-bound, expiring and single use', async () => {
  const rows = new Map();
  const client = { query: async (sql, values) => {
    if (sql.startsWith('DELETE')) return { rows: [] };
    if (sql.startsWith('INSERT')) { rows.set(values[0], { phone: values[1], expiresAt: values[2], consumed: false }); return { rows: [] }; }
    const row = rows.get(values[0]);
    if (!row || row.phone !== values[1] || row.consumed || row.expiresAt <= new Date()) return { rows: [] };
    row.consumed = true; return { rows: [{ id: values[0] }] };
  } };
  const issued = await issueVerificationToken(client, '+919876543210', dev);
  const payload = jwt.verify(issued.token, dev.JWT_SECRET);
  assert.equal(payload.purpose, 'phone_signup');
  await assert.rejects(() => consumeVerificationToken(client, issued.token, '+919876543211', dev), { status: 403 });
  await consumeVerificationToken(client, issued.token, '+919876543210', dev);
  await assert.rejects(() => consumeVerificationToken(client, issued.token, '+919876543210', dev), { status: 403 });
});
