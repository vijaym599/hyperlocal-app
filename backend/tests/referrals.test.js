const test = require('node:test');
const assert = require('node:assert/strict');
const { attachReferral, PLAN_PRICES_PAISE, redeem, reviewRedemption } = require('../referrals');

test('first subscription rewards are 20 percent in integer paise for all plans', async () => {
  const rewards = { basic: 2400, pro: 3980, advance: 9980, enterprise: 19980 };
  for (const [plan, price] of Object.entries(PLAN_PRICES_PAISE)) {
    const calls = [];
    const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ id: 1, phone: '+919876543210', user_type: 'customer', is_admin: false }] }; } };
    await attachReferral(client, 'NB' + 'a'.repeat(24), { id: 10, name: 'Referred shop', user_id: 2, subscription_plan: plan }, '+919876543211');
    assert.equal(calls[1].values[5], price);
    assert.equal(calls[1].values[6], rewards[plan]);
  }
});
test('Basic monthly purchase rewards use the full purchase amount', async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ id: 1, phone: '+919876543210', user_type: 'customer', is_admin: false }] }; } };
  await attachReferral(client, 'NB' + 'a'.repeat(24), { id: 10, name: 'Shop', user_id: 2, subscription_plan: 'basic', subscription_amount_paise: 12000 }, '+919876543211');
  assert.equal(calls[1].values[5], 12000);
  assert.equal(calls[1].values[6], 2400);
});

test('invalid, ineligible and self referral codes cannot create rewards', async () => {
  const shop = { id: 10, name: 'Shop', user_id: 2, subscription_plan: 'pro' };
  const customer = { id: 1, phone: '+919876543210', user_type: 'customer', is_admin: false };
  for (const user of [null, { ...customer, user_type: 'shop_owner' }, { ...customer, is_admin: true }, { ...customer, phone: 'invalid' }, { ...customer, id: 2 }, { ...customer, phone: '919876543211' }]) {
    let inserts = 0;
    const client = { query: async (sql) => { if (sql.includes('INSERT')) inserts++; return { rows: user ? [user] : [] }; } };
    await assert.rejects(() => attachReferral(client, 'NB' + 'A'.repeat(24), shop, '+919876543211'), { status: 400 });
    assert.equal(inserts, 0);
  }
  await assert.rejects(() => attachReferral({}, 'bad', shop, ''), { status: 400 });
  await attachReferral({}, '', shop, '');
});
test('redemption rejects invalid payout details and cannot be directly marked paid', async () => {
  await assert.rejects(() => redeem({}, 1, { account_name: 'A', upi_id: 'bad' }), { status: 400 });
  await assert.rejects(() => reviewRedemption({}, 1, 1, { action: 'paid', payment_reference: 'MOCK_PAY_1' }), { status: 400 });
  await assert.rejects(() => reviewRedemption({}, 1, 1, { action: 'reject' }), { status: 400 });
});
