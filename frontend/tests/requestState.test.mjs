import test from 'node:test';
import assert from 'node:assert/strict';
import { errorPresentation, requestError, RequestError } from '../src/requestState.mjs';

test('request errors retain status without exposing response bodies', () => {
  const error = requestError({ status: 429 }, 'Please slow down.');
  assert.ok(error instanceof RequestError);
  assert.equal(error.status, 429);
  assert.equal(error.message, 'Please slow down.');
});

test('known HTTP failures map to safe user-facing states', () => {
  assert.deepEqual(errorPresentation(new RequestError(401)), {
    kind: 'unauthorized', status: 401, title: 'Your session has expired',
    description: 'Sign in again to continue securely.'
  });
  assert.equal(errorPresentation(new RequestError(403)).kind, 'forbidden');
  assert.equal(errorPresentation(new RequestError(404)).kind, 'not-found');
  assert.equal(errorPresentation(new RequestError(429)).kind, 'rate-limit');
  assert.equal(errorPresentation(new RequestError(503, 'database details')).description, 'We could not complete this request right now. Please try again shortly.');
});

test('network failures and offline browsers use the offline state', () => {
  assert.equal(errorPresentation(new TypeError('fetch failed')).kind, 'offline');
  assert.equal(errorPresentation(new Error('request failed'), false).kind, 'offline');
});

test('ordinary validation messages remain actionable', () => {
  const state = errorPresentation(new RequestError(422, 'Enter a valid phone number.'));
  assert.equal(state.kind, 'error');
  assert.equal(state.description, 'Enter a valid phone number.');
});
