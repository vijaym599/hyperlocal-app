const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Stub the database before loading the API: tests never import db.js or use .env.
const calls = [];
const searchProducts = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, shop_id: 1, name: `Product ${index + 1}` }));
const pool = {
  query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('WITH ranked_products')) return { rows: searchProducts.slice(values[7], values[7] + values[6]) };
    if (sql.includes('INSERT INTO product_requests')) return { rows: [{ id: 1 }] };
    if (sql.includes('SELECT subscription_plan')) return { rows: [{ subscription_plan: 'pro' }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ count: 0 }] };
    if (sql.includes('SELECT id FROM shops')) return { rows: [{ id: 1 }] };
    return { rows: [] };
  },
  initDb: async () => {},
  end: async () => {},
};
require.cache[require.resolve('../db')] = { exports: pool };
require.cache[require.resolve('../geocoder')] = { exports: {
  geocode: async (parameters) => parameters.get('q') === 'unavailable'
    ? Promise.reject(new Error('simulated provider failure'))
    : [{ place_id: 1, display_name: 'Chennai, Tamil Nadu, India', lat: '13.08', lon: '80.27' }],
  searchPlaces: async (query) => query === 'unavailable'
    ? Promise.reject(new Error('simulated provider failure'))
    : [{ id: 'test-1', name: 'Chennai, Tamil Nadu, India', lat: 13.08, lng: 80.27 }],
} };
process.env.JWT_SECRET = 'isolated-test-secret';
process.env.PORT = '0';
const { app, startServer } = require('../index');
let server, base;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));
const post = (path, body, authenticated = false) => fetch(base + path, {
  method: 'POST', headers: {
    'Content-Type': 'application/json',
    ...(authenticated ? { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` } : {}),
  }, body: JSON.stringify(body),
});

test('discovery returns ten products per page and exposes subsequent pages', async () => {
  const first = await (await fetch(base + '/api/search/products?lat=13&lng=80')).json();
  assert.equal(first.results.length, 10);
  assert.equal(first.results[0].id, 1);
  assert.equal(first.next_page, 2);
  assert.equal(first.has_more, true);
  const second = await (await fetch(base + '/api/search/products?lat=13&lng=80&page=2')).json();
  assert.equal(second.results[0].id, 11);
  assert.equal(second.results.length, 10);
  const last = await (await fetch(base + '/api/search/products?lat=13&lng=80&page=3')).json();
  assert.equal(last.results[0].id, 21);
  assert.equal(last.results.length, 5);
  assert.equal(last.has_more, false);
  assert.equal(last.next_page, null);
});

test('discovery validates paging, coordinates and categories', async () => {
  for (const query of ['page=0', 'page=1.5', 'limit=100', 'category=unknown', 'lat=91', 'lng=181']) {
    const parameters = new URLSearchParams({ lat: '13', lng: '80' });
    const [key, value] = query.split('='); parameters.set(key, value);
    assert.equal((await fetch(base + '/api/search/products?' + parameters)).status, 400);
  }
  assert.equal((await fetch(base + '/api/search/products')).status, 400);
});

test('area and pincode lookup returns coordinates or a recoverable provider error', async () => {
  for (const query of ['Chennai', '600001']) {
    const response = await fetch(base + '/api/location/search?' + new URLSearchParams({ query }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.places[0].lat, 13.08);
    assert.equal(result.places[0].lng, 80.27);
  }
  assert.equal((await fetch(base + '/api/location/search?query=a')).status, 400);
  assert.equal((await fetch(base + '/api/location/search?query=unavailable')).status, 502);
});

test('all-distances product requests accept null and omitted radius', async () => {
  for (const radius of [null, undefined]) {
    const response = await post('/api/product-requests', { requested_product: 'Rice', radius_km: radius });
    assert.equal(response.status, 201);
    assert.equal(calls.at(-1).values[4], null);
  }
  const response = await post('/api/product-requests', { requested_product: 'Rice', radius_km: 5 });
  assert.equal(response.status, 201);
  assert.equal(calls.at(-1).values[4], 5);
});

test('invalid radius is rejected without inserting a request', async () => {
  for (const radius of [0, -1, 'invalid']) {
    assert.equal((await post('/api/product-requests', { requested_product: 'Rice', radius_km: radius })).status, 400);
  }
});

test('bulk import rejects blank prices but accepts a real zero price', async () => {
  for (const price of ['', ' ', null, undefined]) {
    const response = await post('/api/shops/1/products/bulk', { products: [{ name: 'Rice', price }] }, true);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /valid price/);
  }
  assert.equal((await post('/api/shops/1/products/bulk', { products: [{ name: 'Rice', price: 0 }] }, true)).status, 201);
});

test('startup waits for initialization before scheduling or listening', async () => {
  let release;
  pool.initDb = () => new Promise((resolve) => { release = resolve; });
  const count = calls.length;
  const starting = startServer();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, count);
  release();
  const started = await starting;
  if (!started.listening) await new Promise((resolve) => started.once('listening', resolve));
  assert.equal(started.listening, true);
  await new Promise((resolve) => started.close(resolve));
});

test('failed initialization closes the pool and does not start the API', async () => {
  let ended = false;
  pool.initDb = async () => { throw new Error('simulated unavailable database'); };
  pool.end = async () => { ended = true; };
  assert.equal(await startServer(), null);
  assert.equal(ended, true);
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
});
