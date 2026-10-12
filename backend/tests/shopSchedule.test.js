const test = require('node:test');
const assert = require('node:assert/strict');
const { refreshSubscriptionEntitlements } = require('../shopSchedule');

test('subscription refresh preserves owner-managed product and offer state', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  await refreshSubscriptionEntitlements(pool);
  assert.equal(calls.length, 0);
});
