const test = require('node:test');
const assert = require('node:assert/strict');
const { refreshSubscriptionEntitlements } = require('../shopSchedule');

test('expired subscriptions force products out of stock and deactivate offers', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  await refreshSubscriptionEntitlements(pool);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /availability_status='out_of_stock'/);
  assert.match(calls[0].sql, /subscription_ends_at <= CURRENT_TIMESTAMP/);
  assert.match(calls[0].sql, /UPDATE shop_offers/);
  assert.match(calls[0].sql, /is_active=FALSE/);
});
