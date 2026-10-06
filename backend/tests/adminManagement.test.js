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
    if (sql.includes('FROM users u')) return { rows: [{ id: 4, owner_name: 'Customer', phone: '+919000000000', user_type: 'customer', is_admin: false, total_count: 1 }] };
    throw new Error('Unexpected query');
  } };
  await withServer(pool, async (base, token) => {
    assert.equal((await fetch(`${base}/api/admin/users`, { headers: { Authorization: `Bearer ${token(1)}` } })).status, 403);
    const response = await fetch(`${base}/api/admin/users?q=Customer&role=shop_owner&verification=verified`, { headers: { Authorization: `Bearer ${token(9)}` } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.users[0].owner_name, 'Customer');
    assert.equal(body.users[0].total_count, undefined);
    assert.deepEqual(body.pagination, { page: 1, limit: 20, total: 1, pages: 1 });
    assert.deepEqual(queries.at(-1).values, ['Customer', 'verified', 20, 0]);
    assert.match(queries.at(-1).sql, /SUM\(e\.reward_paise\)/);
    assert.match(queries.at(-1).sql, /u\.user_type='customer' AND u\.is_admin=FALSE/);
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

test('admin can list subscription attention shops and send one renewal reminder', async () => {
  const calls = [];
  const pool = { query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT is_admin')) return { rows: [{ is_admin: true }] };
    if (sql.includes('AS term_status')) return { rows: [{ id: 12, name: 'Renewal shop', subscription_plan: 'pro', term_status: 'expired' }] };
    if (sql.startsWith('SELECT id,name,subscription_plan')) return { rows: [{ id: 12, name: 'Renewal shop', subscription_plan: 'pro', subscription_status: 'active', subscription_ends_at: '2026-09-01T00:00:00.000Z' }] };
    if (sql.startsWith('INSERT INTO shop_notifications')) return { rows: [{ id: 2, title: 'Subscription renewal reminder', message: 'Renew now', created_at: new Date().toISOString() }] };
    throw new Error('Unexpected query');
  } };
  await withServer(pool, async (base, token) => {
    const headers = { Authorization: `Bearer ${token(9)}` };
    const list = await fetch(`${base}/api/admin/subscriptions?status=attention`, { headers });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).subscriptions[0].term_status, 'expired');
    const reminder = await fetch(`${base}/api/admin/shops/12/subscription-reminder`, { method: 'POST', headers });
    assert.equal(reminder.status, 201);
    assert.match((await reminder.json()).message, /sent/i);
    assert.deepEqual(calls.find(({ sql }) => sql.includes('AS term_status')).values, ['attention']);
    assert.deepEqual(calls.find(({ sql }) => sql.startsWith('INSERT INTO shop_notifications')).values.slice(0, 1), [12]);
  });
});

test('admin can schedule and enable the launch subscription offer', async () => {
  const updates = [];
  const promotion = { id: 1, name: 'Launch offer', is_active: true, purchase_months: 1, bonus_months: 6, eligible_plans: ['pro', 'advance', 'enterprise'], starts_at: '2026-10-01T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z', updated_at: '2026-10-07T00:00:00.000Z' };
  const pool = { query: async (sql, values = []) => {
    if (sql.startsWith('SELECT is_admin')) return { rows: [{ is_admin: true }] };
    if (sql.includes('FROM subscription_promotions')) return { rows: [promotion] };
    if (sql.startsWith('UPDATE subscription_promotions')) { updates.push(values); return { rows: [promotion] }; }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  await withServer(pool, async (base, token) => {
    const headers = { Authorization: `Bearer ${token(9)}`, 'Content-Type': 'application/json' };
    const current = await fetch(`${base}/api/admin/subscription-promotion`, { headers });
    assert.equal(current.status, 200);
    assert.equal((await current.json()).promotion.bonus_months, 6);
    const response = await fetch(`${base}/api/admin/subscription-promotion`, { method: 'PUT', headers, body: JSON.stringify(promotion) });
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /enabled/i);
    assert.deepEqual(updates[0].slice(0, 5), ['Launch offer', true, 1, 6, ['pro', 'advance', 'enterprise']]);
    assert.equal(updates[0][7], 9);
  });
});

test('admin revenue analytics reports totals and plan contribution', async () => {
  const calls = [];
  const pool = { query: async (sql, values = []) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT is_admin')) return { rows: [{ is_admin: true }] };
    if (sql.includes('AS gross_revenue_paise')) return { rows: [{ payment_count: 3, paying_shops: 2, gross_revenue_paise: '89700', average_payment_paise: '29900', bonus_months_granted: 12 }] };
    if (sql.includes('GROUP BY plan')) return { rows: [{ plan: 'advance', payment_count: 1, paying_shops: 1, revenue_paise: '49900', bonus_months_granted: 6 }, { plan: 'pro', payment_count: 2, paying_shops: 1, revenue_paise: '39800', bonus_months_granted: 6 }] };
    if (sql.includes('AS period')) return { rows: [{ period: '2026-10-07', payment_count: 3, revenue_paise: '89700' }] };
    if (sql.includes('FROM shop_subscription_queue q')) return { rows: [{ id: 4, shop_id: 12, shop_name: 'Paid shop', plan: 'pro', amount_paise: 19900, purchase_months: 1, bonus_months: 6 }] };
    throw new Error(`Unexpected query: ${sql}`);
  } };
  await withServer(pool, async (base, token) => {
    const headers = { Authorization: `Bearer ${token(9)}` };
    assert.equal((await fetch(`${base}/api/admin/revenue?range=invalid`, { headers })).status, 400);
    const response = await fetch(`${base}/api/admin/revenue?range=30`, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.totals.gross_revenue_paise, '89700');
    assert.equal(body.plans[0].plan, 'advance');
    assert.equal(body.recent_payments[0].shop_name, 'Paid shop');
    assert.ok(calls.filter(({ values }) => values[0] === 30).length >= 4);
  });
});
