const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const { initAnalytics, mountAnalytics } = require('../analytics');

test('analytics schema includes visit constraints and reporting indexes', async () => {
  let sql = '';
  await initAnalytics({ query: async (value) => { sql = value; return { rows: [] }; } });
  assert.match(sql, /CREATE TABLE IF NOT EXISTS page_visits/);
  assert.match(sql, /page_visits_page_check/);
  assert.match(sql, /page_visits_visitor_date_idx/);
});

test('visit collection validates anonymous IDs and admin overview checks database role', async () => {
  process.env.JWT_SECRET = 'analytics-test-secret';
  const inserts = [];
  const pool = { query: async (sql, values = []) => {
    if (sql.startsWith('INSERT INTO page_visits')) { inserts.push(values); return { rows: [] }; }
    if (sql.startsWith('SELECT is_admin')) return { rows: [{ is_admin: values[0] === 2 }] };
    if (sql.includes("AS total_users")) return { rows: [{ total_users: 3, customers: 3, shop_owners: 1, admins: 1, total_shops: 1, verified_shops: 1, total_products: 8, open_requests: 2 }] };
    if (sql.includes('COUNT(DISTINCT visitor_id)') && sql.includes('::date=')) return { rows: [{ page_views: 4, unique_visitors: 2 }] };
    if (sql.startsWith('WITH dates')) return { rows: [{ day: '2026-10-02', page_views: 4, unique_visitors: 2, new_users: 1, new_shops: 1 }] };
    if (sql.includes('GROUP BY page_name')) return { rows: [{ page_name: 'explore', page_views: 4, unique_visitors: 2 }] };
    if (sql.includes("FROM users WHERE user_type='customer'")) return { rows: [] };
    if (sql.includes('FROM shops ORDER BY')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
  } };
  const app = express(); app.use(express.json());
  mountAnalytics(app, pool, authenticate, () => (req, res, next) => next());
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(base + '/api/analytics/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ visitor_id: 'bad', page_name: 'explore' })).status, 400);
    assert.equal((await post({ visitor_id: '123e4567-e89b-42d3-a456-426614174000', page_name: 'admin-secret' })).status, 400);
    assert.equal((await post({ visitor_id: '123e4567-e89b-42d3-a456-426614174000', page_name: 'explore' })).status, 204);
    assert.deepEqual(inserts, [['123e4567-e89b-42d3-a456-426614174000', 'explore']]);
    const overview = (userId, days = 30) => fetch(`${base}/api/admin/overview?days=${days}`, { headers: { Authorization: `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET)}` } });
    assert.equal((await overview(1)).status, 403);
    assert.equal((await overview(2, 8)).status, 400);
    const response = await overview(2);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totals.total_users, 3);
    assert.equal(body.today.unique_visitors, 2);
    assert.equal(body.daily[0].page_views, 4);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
