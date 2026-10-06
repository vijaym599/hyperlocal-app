const test = require('node:test');
const assert = require('node:assert/strict');
const { promotedSubscriptionTerms, validatePromotion } = require('../subscriptionPromotions');

test('active one-month launch offer adds six free months without changing the charge', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ id: 1, name: 'Launch offer', bonus_months: 6 }] };
  } };
  assert.deepEqual(await promotedSubscriptionTerms(pool, 'pro'), {
    months: 1,
    days: 210,
    amountPaise: 19900,
    purchaseMonths: 1,
    bonusMonths: 6,
    totalMonths: 7,
    promotionId: 1,
    promotionName: 'Launch offer',
  });
  assert.deepEqual(calls[0].values, ['pro', 1]);
});

test('promotion eligibility is checked against the plan paid term', async () => {
  const pool = { query: async (_sql, values) => ({ rows: values[1] === 1 ? [{ id: 1, name: 'Launch offer', bonus_months: 6 }] : [] }) };
  assert.deepEqual(await promotedSubscriptionTerms(pool, 'basic'), {
    months: 6,
    days: 180,
    amountPaise: 12000,
    purchaseMonths: 6,
    bonusMonths: 0,
    totalMonths: 6,
    promotionId: null,
    promotionName: null,
  });
});

test('admin promotion settings require valid plans and a forward date range', () => {
  const settings = validatePromotion({
    name: 'Opening offer', is_active: true, purchase_months: 1, bonus_months: 6,
    eligible_plans: ['pro', 'advance', 'pro'], starts_at: '2026-10-01T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z',
  });
  assert.equal(settings.isActive, true);
  assert.deepEqual(settings.eligiblePlans, ['pro', 'advance']);
  assert.throws(() => validatePromotion({ name: 'Bad', purchase_months: 1, bonus_months: 6, eligible_plans: ['free'], starts_at: settings.startsAt, ends_at: settings.endsAt }), /valid subscription plan/);
  assert.throws(() => validatePromotion({ name: 'Bad dates', purchase_months: 1, bonus_months: 6, eligible_plans: ['pro'], starts_at: '2026-12-01', ends_at: '2026-10-01' }), /after its start/);
});
