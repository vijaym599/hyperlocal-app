const test = require('node:test');
const assert = require('node:assert/strict');
const { DAY_HOURS, WEEK_HOURS, MONTH_HOURS, freshnessHoursFor, stockState } = require('../stockFreshness');

test('stock freshness windows reflect perishable, everyday and durable products', () => {
  assert.equal(freshnessHoursFor({ name: 'Fresh Milk', shop_category: 'Grocery & Supermarket' }), DAY_HOURS);
  assert.equal(freshnessHoursFor({ name: 'Ponni Rice', shop_category: 'Grocery & Supermarket' }), WEEK_HOURS);
  assert.equal(freshnessHoursFor({ name: 'Smartphone', shop_category: 'Electronics & Mobiles' }), MONTH_HOURS);
});

test('stale availability becomes unconfirmed without overwriting out of stock', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  assert.deepEqual(stockState({ name: 'Milk', availability_status: 'available', availability_updated_at: '2026-10-21T06:00:00Z' }, now), { effectiveStatus: 'available', freshness: 'confirmed' });
  assert.deepEqual(stockState({ name: 'Milk', availability_status: 'available', availability_updated_at: '2026-10-19T06:00:00Z' }, now), { effectiveStatus: 'unconfirmed', freshness: 'stale' });
  assert.deepEqual(stockState({ name: 'Milk', availability_status: 'out_of_stock', availability_updated_at: '2026-01-01T00:00:00Z' }, now), { effectiveStatus: 'out_of_stock', freshness: 'confirmed' });
});
