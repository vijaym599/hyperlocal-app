import test from 'node:test';
import assert from 'node:assert/strict';
import { indianLocalPhone, indianPhoneE164 } from '../src/phone.mjs';

test('Indian authentication phone input accepts local formats and emits one E.164 identity', () => {
  assert.equal(indianLocalPhone('98765 43210'), '9876543210');
  assert.equal(indianLocalPhone('+91 98765-43210'), '9876543210');
  assert.equal(indianLocalPhone('09876543210'), '9876543210');
  assert.equal(indianPhoneE164('9876543210'), '+919876543210');
  assert.equal(indianPhoneE164('12345'), '');
  assert.equal(indianPhoneE164('5876543210'), '');
});
