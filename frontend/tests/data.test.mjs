import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductCsv } from '../src/csv.mjs';
import { homeTab, resolveTab } from '../src/session.mjs';

test('restored sessions and restricted navigation resolve to the correct home', () => {
  const owner = { token: 'token', user: { user_type: 'shop_owner' }, shop: { id: 1 } };
  const admin = { token: 'token', user: { is_admin: true } };
  const customer = { token: 'token', user: { user_type: 'customer' } };
  assert.equal(homeTab(owner), 'my-shop');
  assert.equal(homeTab(admin), 'demand');
  assert.equal(homeTab(customer), 'explore');
  assert.equal(resolveTab('explore', owner), 'my-shop');
  assert.equal(resolveTab('my-shop', admin), 'demand');
  assert.equal(resolveTab('demand', null), 'explore');
  assert.equal(resolveTab('activity', null), 'explore');
  assert.equal(resolveTab('my-shop', customer), 'explore');
  assert.equal(resolveTab('shop-portfolio', customer, null), 'explore');
  assert.equal(resolveTab('shop-portfolio', owner, { id: 1 }), 'shop-portfolio');
  assert.equal(resolveTab('shop-portfolio', admin, { id: 1 }), 'shop-portfolio');
  assert.equal(resolveTab('shop-portfolio', customer, { id: 1 }), 'shop-portfolio');
  assert.equal(resolveTab('shop-portfolio', null, { id: 1 }), 'shop-portfolio');
  assert.equal(resolveTab('shop-portfolio', owner, null), 'my-shop');
  assert.equal(resolveTab('privacy', admin), 'privacy');
});

test('CSV accepts commas, escaped quotes, multiline descriptions, BOM and zero prices', () => {
  assert.deepEqual(parseProductCsv('\uFEFFname,price,description\r\n"Rice, premium",0,"Line 1\nLine ""2"""\r\n'), [
    { name: 'Rice, premium', price: '0', description: 'Line 1\nLine "2"' },
  ]);
});

test('CSV rejects malformed rows and missing or invalid prices', () => {
  for (const input of [
    '', 'name,price\nRice,', 'name,price\nRice,-1', 'name,price\nRice,no',
    'name,price\nRice,10,extra', 'name,price\n"Rice,10',
    'name,price\n"Rice"bad,10', 'name,name,price\nRice,Rice,10',
  ]) assert.throws(() => parseProductCsv(input));
});
