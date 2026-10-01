const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
// The API suite stubs this module; reload it for the isolated local-provider test.
delete require.cache[require.resolve('../geocoder')];
const { geocode, searchPlaces } = require('../geocoder');

test('geocoder caches requests and spaces forward/reverse provider requests', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, time: Date.now(), agent: req.headers['user-agent'] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ display_name: 'Test area' }));
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const old = process.env.GEOCODER_BASE_URL;
  process.env.GEOCODER_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    const parameters = new URLSearchParams({ q: 'Chennai', format: 'jsonv2' });
    const first = await geocode(parameters);
    assert.deepEqual(await geocode(parameters), first);
    assert.equal(requests.length, 1);
    await geocode(new URLSearchParams({ lat: '13', lon: '80', format: 'jsonv2' }));
    assert.equal(requests.length, 2);
    assert.ok(requests[1].time - requests[0].time >= 1000);
    assert.match(requests[0].url, /^\/search\?/);
    assert.match(requests[1].url, /^\/reverse\?/);
    assert.ok(requests[0].agent);
  } finally {
    if (old === undefined) delete process.env.GEOCODER_BASE_URL;
    else process.env.GEOCODER_BASE_URL = old;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('area lookup falls back when the primary provider denies access', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url.startsWith('/search?')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access denied');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ features: [{
      geometry: { coordinates: [80.27, 13.08] },
      properties: { osm_type: 'R', osm_id: 1, name: 'Chennai', state: 'Tamil Nadu', country: 'India', countrycode: 'IN' },
    }] }));
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const oldPrimary = process.env.GEOCODER_BASE_URL;
  const oldFallback = process.env.PHOTON_GEOCODER_BASE_URL;
  process.env.GEOCODER_BASE_URL = base;
  process.env.PHOTON_GEOCODER_BASE_URL = base;
  try {
    const places = await searchPlaces('Fallback test area');
    assert.deepEqual(places, [{ id: 'photon-R-1', name: 'Chennai, Tamil Nadu, India', lat: 13.08, lng: 80.27, countryCode: 'IN' }]);
    assert.equal(requests.length, 2);
    assert.match(requests[0], /^\/search\?/);
    assert.match(requests[1], /^\/api\/\?/);
  } finally {
    if (oldPrimary === undefined) delete process.env.GEOCODER_BASE_URL;
    else process.env.GEOCODER_BASE_URL = oldPrimary;
    if (oldFallback === undefined) delete process.env.PHOTON_GEOCODER_BASE_URL;
    else process.env.PHOTON_GEOCODER_BASE_URL = oldFallback;
    await new Promise((resolve) => server.close(resolve));
  }
});
