import test from 'node:test';
import assert from 'node:assert/strict';
import { shopShareLink, shopIdFromSearch } from '../src/shopLinks.mjs';

test('shop links include shop name and place and resolve to the same catalog', () => {
  const link = shopShareLink('https://nearbuy.example', { id: 42, name: 'Sri Murugan Stores', city: 'Chennai', address: '123 Main Road, Anna Nagar, Chennai' });
  assert.equal(link, 'https://nearbuy.example/?shop=sri-murugan-stores-chennai-42');
  assert.equal(shopShareLink('https://nearbuy.example', { id: 42, name: 'Sri Murugan Stores', address: '123 Main Road, Anna Nagar, Chennai' }), 'https://nearbuy.example/?shop=sri-murugan-stores-42');
  assert.equal(shopIdFromSearch('?shop=sri-murugan-stores-anna-nagar-chennai-42'), 42);
  assert.equal(shopIdFromSearch(new URL(link).search), 42);
  assert.equal(shopIdFromSearch('?shop=42'), 42);
  assert.equal(shopShareLink('https://nearbuy.example', { id: 2, name: 'Shop & Store' }), 'https://nearbuy.example/?shop=shop-store-2');
  const tamil = shopShareLink('https://nearbuy.example', { id: 9, name: 'தமிழ் கடை' });
  assert.equal(shopIdFromSearch(new URL(tamil).search), 9);
  for (const search of ['', '?shop=0', '?shop=-1', '?shop=test', '?shop=test-2147483648']) assert.equal(shopIdFromSearch(search), null);
});
