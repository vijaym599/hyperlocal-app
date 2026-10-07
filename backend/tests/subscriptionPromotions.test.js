const test = require('node:test');
const assert = require('node:assert/strict');
const { promotedSubscriptionTerms, claimPromotionRedemption, validatePromotion } = require('../subscriptionPromotions');

test('active annual offer adds eleven free months without changing the charge', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ id: 1, name: '2027 Annual Offer', bonus_months: 11 }] };
  } };
  assert.deepEqual(await promotedSubscriptionTerms(pool, 'pro'), {
    months: 1,
    days: 360,
    amountPaise: 19900,
    purchaseMonths: 1,
    bonusMonths: 11,
    totalMonths: 12,
    promotionId: 1,
    promotionCampaignVersion: 1,
    promotionName: '2027 Annual Offer',
  });
  assert.deepEqual(calls[0].values, ['pro', 1, null]);
});

test('annual offer applies to Basic because every plan has a one-month paid term', async () => {
  const pool = { query: async (_sql, values) => ({ rows: values[1] === 1 ? [{ id: 1, name: '2027 Annual Offer', bonus_months: 11 }] : [] }) };
  assert.deepEqual(await promotedSubscriptionTerms(pool, 'basic'), {
    months: 1,
    days: 360,
    amountPaise: 12000,
    purchaseMonths: 1,
    bonusMonths: 11,
    totalMonths: 12,
    promotionId: 1,
    promotionCampaignVersion: 1,
    promotionName: '2027 Annual Offer',
  });
});

test('a shop that redeemed the campaign receives only the regular paid term on later purchases', async () => {
  const pool = { query: async (sql, values) => {
    assert.match(sql, /subscription_promotion_redemptions/);
    assert.deepEqual(values, ['pro', 1, 42]);
    return { rows: [] };
  } };
  assert.deepEqual(await promotedSubscriptionTerms(pool, 'pro', { shopId: 42 }), {
    months: 1,
    days: 30,
    amountPaise: 19900,
    purchaseMonths: 1,
    bonusMonths: 0,
    totalMonths: 1,
    promotionId: null,
    promotionCampaignVersion: null,
    promotionName: null,
  });
});

test('promotion redemption ledger rejects a concurrent second claim', async () => {
  const terms = { promotionId: 1, promotionCampaignVersion: 3, bonusMonths: 11 };
  const accepted = { query: async (_sql, values) => { assert.deepEqual(values, [8, 1, 3, 90]); return { rows: [{ shop_id: 8 }] }; } };
  assert.equal(await claimPromotionRedemption(accepted, { shopId: 8, purchaseId: 90, terms }), true);
  const duplicate = { query: async () => ({ rows: [] }) };
  await assert.rejects(() => claimPromotionRedemption(duplicate, { shopId: 8, purchaseId: 91, terms }), /already used/);
});

test('admin promotion settings require valid plans and a forward date range', () => {
  const settings = validatePromotion({
    name: 'Opening offer', is_active: true, purchase_months: 1, bonus_months: 11,
    eligible_plans: ['basic', 'pro', 'advance', 'pro'], starts_at: '2026-10-01T00:00:00.000Z', ends_at: '2027-12-31T18:30:00.000Z',
  });
  assert.equal(settings.isActive, true);
  assert.deepEqual(settings.eligiblePlans, ['basic', 'pro', 'advance']);
  assert.throws(() => validatePromotion({ name: 'Bad', purchase_months: 1, bonus_months: 6, eligible_plans: ['free'], starts_at: settings.startsAt, ends_at: settings.endsAt }), /valid subscription plan/);
  assert.throws(() => validatePromotion({ name: 'Bad dates', purchase_months: 1, bonus_months: 6, eligible_plans: ['pro'], starts_at: '2026-12-01', ends_at: '2026-10-01' }), /after its start/);
});
