import test from 'node:test';
import assert from 'node:assert/strict';
import { shopContactLinks } from '../src/shopContact.mjs';

test('shop contacts normalize Indian phones and open directions including zero coordinates', () => {
  const links = shopContactLinks({ name: 'Test shop', phone: '98765 43210', whatsapp_number: '919876543210', latitude: 0, longitude: 80 });
  assert.equal(links.call, 'tel:+919876543210');
  assert.match(links.whatsapp, /^https:\/\/wa.me\/919876543210\?text=/);
  assert.match(decodeURIComponent(links.whatsapp), /Test shop/);
  assert.equal(links.directions, 'https://www.google.com/maps/dir/?api=1&destination=0,80');
});

test('missing and invalid contacts are hidden; directions fall back to map or address', () => {
  assert.deepEqual(shopContactLinks({}), { call: null, whatsapp: null, directions: null });
  const links = shopContactLinks({ name: 'Store', address: 'Chennai', phone: 'abc', whatsapp_number: '123', latitude: '', longitude: '', google_map_link: 'javascript:alert(1)' });
  assert.equal(links.call, null); assert.equal(links.whatsapp, null);
  assert.equal(links.directions, 'https://www.google.com/maps/search/?api=1&query=Store%20Chennai');
  assert.equal(shopContactLinks({ google_map_link: 'https://maps.google.com/?q=Chennai' }).directions, 'https://maps.google.com/?q=Chennai');
});
