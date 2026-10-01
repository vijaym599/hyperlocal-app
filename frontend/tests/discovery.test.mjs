import test from 'node:test';
import assert from 'node:assert/strict';
import { readDiscoveryCache, writeDiscoveryCache, mergeProducts, discoveryKey } from '../src/discoveryCache.mjs';

const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
};
const location = { lat: 13.08, lng: 80.27, name: 'Chennai', source: 'manual' };
const data = { results: [{ id: 1, shop_id: 2, name: 'Rice', price: 10, image_url: 'data:image/webp;base64,large' }], has_more: true };

test('first-page cache restores cards and chosen area without storing inline images', () => {
  const saved = storage();
  writeDiscoveryCache(saved, 'api', location, data, 1000);
  const cache = readDiscoveryCache(saved, 'api', 2000);
  assert.deepEqual(cache.location, location);
  assert.equal(cache.results[0].name, 'Rice');
  assert.equal(cache.results[0].image_url, '');
  assert.equal(cache.has_more, true);
});

test('expired, corrupt, future, cross-server, and invalid-coordinate snapshots are ignored', () => {
  const saved = storage();
  writeDiscoveryCache(saved, 'api', location, data, 1000);
  assert.equal(readDiscoveryCache(saved, 'other-api', 2000), null);
  assert.equal(readDiscoveryCache(saved, 'api', 1000 + 31 * 60 * 1000), null);
  assert.equal(readDiscoveryCache(saved, 'api', 999), null);
  saved.setItem('nearbuy-discovery-v1', 'invalid-json');
  assert.equal(readDiscoveryCache(saved, 'api'), null);
  writeDiscoveryCache(saved, 'api', { lat: 100, lng: 0 }, data, 1000);
  assert.equal(readDiscoveryCache(saved, 'api', 2000), null);
});

test('unavailable storage does not prevent network discovery', () => {
  const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('full'); } };
  assert.equal(readDiscoveryCache(blocked, 'api'), null);
  assert.doesNotThrow(() => writeDiscoveryCache(blocked, 'api', location, data));
});

test('progressive pages deduplicate products and replace updated values', () => {
  const merged = mergeProducts([{ id: 1, price: 10 }], [{ id: 1, price: 20 }, { id: 2, price: 30 }]);
  assert.deepEqual(merged, [{ id: 1, price: 20 }, { id: 2, price: 30 }]);
});

test('each location and filter combination identifies a separate result set', () => {
  const current = discoveryKey(location);
  for (const other of [
    discoveryKey({ lat: 12, lng: 80 }), discoveryKey(location, 'rice'),
    discoveryKey(location, '', '5'), discoveryKey(location, '', '', 'available'),
    discoveryKey(location, '', '', 'all', 'grocery'),
  ]) assert.notEqual(current, other);
});
