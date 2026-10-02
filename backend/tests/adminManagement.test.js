const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const { mountAdminManagement } = require('../adminManagement');

async function withServer(pool, run) {
  process.env.JWT_SECRET = 'admin-management-test-secret';
  const app = express(); app.use(express.json()); mountAdminManagement(app, pool, authenticate);
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);
  try { await run(`http://127.0.0.1:${server.address().port}`, token); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('admin user management is protected and returns paginated account details', async () => {
  const queries = [];
  const pool = { query: async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.startsWith('SELECT is_admin')) return { rows: [{ is_admin: values[0] === 9 }] };
    if (sql.includes('FROM users u LEFT JOIN shops')) return { rows: [{ id: 4, owner_name: 'Owner', phone: '+919000000000', user_type: 'shop_owner', total_count: 1 }] };
    throw new Error('Unexpected query');
  } };
  await withServer(pool, async (base, token) => {
    assert.equal((await fetch(`${base}/api/admin/users`, { headers: { Authorization: `Bearer ${token(1)}` } })).status, 403);
    const response = await fetch(`${base}/api/admin/users?q=Owner&role=shop_owner&verification=verified`, { headers: { Authorization: `Bearer ${token(9)}` } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.users[0].owner_name, 'Owner');
    assert.equal(body.users[0].total_count, undefined);
    assert.deepEqual(body.pagination, { page: 1, limit: 20, total: 1, pages: 1 });
    assert.deepEqual(queries.at(-1).values, ['Owner', 'shop_owner', 'verified', 20, 0]);
    assert.match(queries.at(-1).sql, /SUM\(e\.reward_paise\)/);
  });
});

test('admin can update a valid shop operating status', async () => {
  const updates = [];
  const pool = { query: async (sql, values = []) => {
    if (sql.startsWith('SELECT is_admin')) return { rows: [{ is_admin: true }] };
    if (sql.startsWith('UPDATE shops SET is_open')) { updates.push(values); return { rows: [{ id: values[1], name: 'Test shop', is_open: values[0] }] }; }
    throw new Error('Unexpected query');
  } };
  await withServer(pool, async (base, token) => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token(9)}` };
    assert.equal((await fetch(`${base}/api/admin/shops/no/open-status`, { method: 'PATCH', headers, body: JSON.stringify({ is_open: false }) })).status, 400);
    const response = await fetch(`${base}/api/admin/shops/12/open-status`, { method: 'PATCH', headers, body: JSON.stringify({ is_open: false }) });
    assert.equal(response.status, 200);
    assert.deepEqual(updates, [[false, 12]]);
  });
});
