const test = require('node:test');
const assert = require('node:assert/strict');
const { subscriptionTerms } = require('../subscriptionTerms');

test('Basic purchases require six months while upgrades remain monthly', () => {
  assert.deepEqual(subscriptionTerms('basic'), { months: 6, days: 180, amountPaise: 12000 });
  assert.deepEqual(subscriptionTerms('pro'), { months: 1, days: 30, amountPaise: 19900 });
  assert.deepEqual(subscriptionTerms('advance'), { months: 1, days: 30, amountPaise: 49900 });
  assert.deepEqual(subscriptionTerms('enterprise'), { months: 1, days: 30, amountPaise: 99900 });
  assert.throws(() => subscriptionTerms('invalid'));
});
