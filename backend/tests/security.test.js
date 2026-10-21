const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const { isStrongPassword, isUsablePasswordInput } = require('../passwordPolicy');
const { requestId, securityHeaders, adminAudit, notFound, handleError } = require('../security');

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

test('successful admin mutations are audit logged without request data', async () => {
  const writes = [];
  const pool = { query: async (sql, values) => { writes.push({ sql, values }); return { rows: [] }; } };
  const app = express();
  app.use(express.json()); app.use(requestId); app.use(adminAudit(pool));
  app.patch('/api/admin/shops/:shopId/open-status', (req, res) => {
    req.user = { userId: 9 };
    res.json({ received_secret: req.body.secret });
  });
  app.patch('/api/admin/failure', (req, res) => { req.user = { userId: 9 }; res.status(400).json({ error: 'bad' }); });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/admin/shops/12/open-status?token=hidden`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'never-log-me' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await fetch(`${base}/api/admin/failure`, { method: 'PATCH' })).status, 400);
    await new Promise((resolve) => setImmediate(resolve));
  });
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT INTO admin_audit_logs/);
  assert.equal(writes[0].values[0], 9);
  assert.equal(writes[0].values[2], 'PATCH');
  assert.equal(writes[0].values[3], '/api/admin/shops/:shopId/open-status');
  assert.equal(writes[0].values[5], '12');
  assert.equal(JSON.stringify(writes[0]).includes('never-log-me'), false);
  assert.equal(JSON.stringify(writes[0]).includes('hidden'), false);
});
