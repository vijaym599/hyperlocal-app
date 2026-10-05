import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../src/apiResponse.mjs';

test('OTP responses preserve successful JSON and backend error messages', async () => {
  assert.deepEqual(await readApiResponse(new Response('{"message":"Code sent"}')), { message: 'Code sent' });
  await assert.rejects(readApiResponse(new Response('{"error":"Wait one minute"}', { status: 429 })), /Wait one minute/);
});

test('HTML gateway errors and misrouted pages display actionable OTP errors', async () => {
  await assert.rejects(readApiResponse(new Response('<!DOCTYPE html><h1>Bad gateway</h1>', { status: 502 })), /temporarily unavailable/);
  await assert.rejects(readApiResponse(new Response('<!DOCTYPE html><div id="root"></div>')), /reload the page/);
  await assert.rejects(readApiResponse(new Response('null')), /invalid response/);
});
