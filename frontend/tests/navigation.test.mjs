import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationItems, navigationUrl, routeFromLocation } from '../src/navigation.mjs';

test('route state restores views, sections, shop links and referrals', () => {
  assert.deepEqual(routeFromLocation({ search: '?view=offers' }), { tab: 'offers', section: null, shopId: null });
  assert.deepEqual(routeFromLocation({ search: '?view=activity&section=rewards' }), { tab: 'activity', section: 'rewards', shopId: null });
  assert.deepEqual(routeFromLocation({ search: '?shop=anna-stores-42' }), { tab: 'shop-portfolio', section: null, shopId: 42 });
  assert.equal(routeFromLocation({ search: '?ref=ABC123' }).tab, 'my-shop');
});

test('navigation URLs preserve unrelated query parameters and clear stale route state', () => {
  assert.equal(navigationUrl({ href: 'https://nearbuy.test/?campaign=summer&view=offers' }, { tab: 'assistant' }), '/?campaign=summer&view=assistant');
  assert.equal(navigationUrl({ href: 'https://nearbuy.test/?shop=old-4' }, { tab: 'explore' }), '/');
  assert.equal(navigationUrl({ href: 'https://nearbuy.test/' }, { tab: 'demand', section: 'shops' }), '/?view=demand&section=shops');
});

test('customer navigation keeps the same destinations but changes the account target by role', () => {
  assert.equal(navigationItems('guest').at(-1).target, 'customer-auth');
  assert.equal(navigationItems('customer').at(-1).target, 'activity');
  assert.deepEqual(navigationItems('admin'), []);
});
