const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mountCustomerNotifications, notifyStockAvailable } = require('../customerNotifications');

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('customers can subscribe and use the top notification inbox', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith('INSERT INTO product_stock_alerts')) return { rows: [{ product_id: 12 }] };
    if (sql.includes('FROM customer_notifications n')) return { rows: [{ id: 4, title: 'Milk is available', message: 'Milk was confirmed available.', read_at: null, shop_id: 2 }] };
    return { rows: [] };
  } };
  const app = express(); app.use(express.json());
  mountCustomerNotifications(app, pool, (req, _res, next) => { req.user = { userId: 7 }; next(); });
  await withServer(app, async (base) => {
    const subscription = await fetch(`${base}/api/products/12/stock-alert`, { method: 'POST' });
    assert.equal(subscription.status, 201);
    assert.equal((await subscription.json()).subscribed, true);
    const inbox = await (await fetch(`${base}/api/customer/notifications`)).json();
    assert.equal(inbox.unread_count, 1);
    assert.equal(inbox.notifications[0].shop_id, 2);
    assert.equal((await fetch(`${base}/api/customer/notifications/read`, { method: 'PATCH' })).status, 200);
  });
  assert.deepEqual(calls[0].values, [7, 12]);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id,product_id\)/);
  assert.match(calls.at(-1).sql, /read_at=CURRENT_TIMESTAMP/);
});

test('availability confirmation completes alerts once and creates notifications', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ id: 91 }, { id: 92 }] }; } };
  assert.equal(await notifyStockAvailable(pool, [5, 5, 8, -1]), 2);
  assert.deepEqual(calls[0].values, [[5, 8]]);
  assert.match(calls[0].sql, /SET active=FALSE, notified_at=CURRENT_TIMESTAMP/);
  assert.match(calls[0].sql, /INSERT INTO customer_notifications/);
});
