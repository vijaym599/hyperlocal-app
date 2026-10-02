import test from 'node:test';
import assert from 'node:assert/strict';
import { referralFromSearch, referralLink, formatMoney } from '../src/referrals.mjs';

test('referral links preserve the code without copying unrelated query parameters', () => {
  const code = 'NB' + 'A'.repeat(24);
  const url = referralLink('https://nearbuy.test', code);
  assert.equal(new URL(url).pathname, '/');
  assert.equal(referralFromSearch(new URL(url).search), code);
  assert.equal(referralFromSearch('?ref=' + code.toLowerCase()), code);
  for (const query of ['', '?ref=1', '?ref=<script>', '?ref=NB123']) assert.equal(referralFromSearch(query), '');
});
test('referral amounts retain paise precision', () => {
  assert.equal(formatMoney(3980), '₹39.80');
  assert.equal(formatMoney(400), '₹4.00');
  assert.equal(formatMoney(19980), '₹199.80');
});
