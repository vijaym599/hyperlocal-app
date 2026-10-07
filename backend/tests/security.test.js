const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const { isStrongPassword, isUsablePasswordInput } = require('../passwordPolicy');
const { requestId, securityHeaders, notFound, handleError } = require('../security');

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('security middleware sets restrictive browser headers and sanitized errors', async () => {
  const app = express();
  app.disable('x-powered-by'); app.use(requestId); app.use(securityHeaders); app.use(express.json({ limit: '1kb' }));
  app.post('/echo', (req, res) => res.json(req.body)); app.use(notFound); app.use(handleError);
  await withServer(app, async (base) => {
    const ok = await fetch(`${base}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(ok.status, 200); assert.match(ok.headers.get('content-security-policy'), /object-src 'none'/); assert.ok(ok.headers.get('x-request-id')); assert.equal(ok.headers.get('x-powered-by'), null);
    const malformed = await fetch(`${base}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400); assert.equal((await malformed.json()).error, 'Request body must contain valid JSON.');
    const missing = await fetch(`${base}/api/secret?token=must-not-be-echoed`); const missingBody = await missing.text();
    assert.equal(missing.status, 404); assert.equal(missingBody.includes('must-not-be-echoed'), false);
  });
});

test('JWT authentication accepts only HS256 and password inputs are bounded', async () => {
  process.env.JWT_SECRET = 'security-test-secret';
  const app = express(); app.use(requestId); app.get('/private', authenticate, (_req, res) => res.json({ ok: true }));
  await withServer(app, async (base) => {
    const good = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    assert.equal((await fetch(`${base}/private`, { headers: { Authorization: `Bearer ${good}` } })).status, 200);
    const wrongAlgorithm = jwt.sign({ userId: 1 }, 'different-secret', { algorithm: 'HS384' });
    assert.equal((await fetch(`${base}/private`, { headers: { Authorization: `Bearer ${wrongAlgorithm}` } })).status, 401);
  });
  assert.equal(isStrongPassword('StrongPass1'), true); assert.equal(isStrongPassword('passwordonly'), false); assert.equal(isStrongPassword('short1'), false);
  assert.equal(isUsablePasswordInput('x'.repeat(73)), false); assert.equal(isUsablePasswordInput('x'.repeat(72)), true);
});
