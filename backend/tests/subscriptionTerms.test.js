const test = require('node:test');
const assert = require('node:assert/strict');
const { subscriptionTerms } = require('../subscriptionTerms');

test('all subscription plans use a one-month paid term', () => {
  assert.deepEqual(subscriptionTerms('basic'), { months: 1, days: 30, amountPaise: 12000 });
  assert.deepEqual(subscriptionTerms('pro'), { months: 1, days: 30, amountPaise: 19900 });
  assert.deepEqual(subscriptionTerms('advance'), { months: 1, days: 30, amountPaise: 49900 });
  assert.deepEqual(subscriptionTerms('enterprise'), { months: 1, days: 30, amountPaise: 99900 });
  assert.throws(() => subscriptionTerms('invalid'));
});
