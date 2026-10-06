const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Stub the database before loading the API: tests never import db.js or use .env.
const calls = [];
const verificationClaims = new Map();
const loginUser = { id: 91, phone: '+919876543210', email: null, owner_name: 'Two step user', user_type: 'customer', is_admin: false, auth_version: 1, password: bcrypt.hashSync('Password123', 4) };
const searchProducts = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, shop_id: 1, name: `Product ${index + 1}` }));
const pool = {
  query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql === 'SELECT * FROM users WHERE phone = $1') return { rows: values[0] === loginUser.phone ? [{ ...loginUser }] : [] };
    if (sql === 'SELECT * FROM shops WHERE user_id = $1') return { rows: [] };
    if (sql.startsWith('DELETE FROM phone_verification_claims')) return { rows: [] };
    if (sql.startsWith('INSERT INTO phone_verification_claims')) { verificationClaims.set(values[0], { phone: values[1], expiresAt: values[2], consumed: false }); return { rows: [] }; }
    if (sql.startsWith('UPDATE phone_verification_claims')) {
      const claim = verificationClaims.get(values[0]);
      if (!claim || claim.phone !== values[1] || claim.consumed || claim.expiresAt <= new Date()) return { rows: [] };
      claim.consumed = true; return { rows: [{ id: values[0] }] };
    }
    if (sql.includes('SELECT auth_version FROM users')) return { rows: [{ auth_version: 1 }] };
    if (sql.includes('AS product_count')) return { rows: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Shop ${i + 1}`, product_count: 2 })) };
    if (sql.includes('WITH ranked_products')) return { rows: searchProducts.slice(values[7], values[7] + values[6]) };
    if (sql.includes('INSERT INTO product_requests')) return { rows: [{ id: 1 }] };
    if (sql.includes('SELECT subscription_plan')) return { rows: [{ subscription_plan: 'pro' }] };
    if (sql.includes('UPDATE products p')) return { rows: [{ id: 1, name: values[0], description: values[1], brand: values[2], price: values[3] }] };
    if (sql.includes('SELECT s.id, s.name, s.category')) return { rows: [{ id: 1, name: 'Test shop' }] };
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
process.env.NODE_ENV = 'test';
process.env.PHONE_OTP_PROVIDER = 'development';
process.env.DEVELOPMENT_OTP_CODE = '654321';
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

test('shop directory is public, paginated, and independent of SEO configuration', async () => {
  const response = await fetch(base + '/api/shops/catalogs?page=2');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.shops.length, 24);
  assert.equal(data.has_more, true);
  assert.deepEqual(calls.findLast(call => call.sql.includes('AS product_count')).values, [24]);
  for (const page of ['0', '-1', 'abc', '1.5']) assert.equal((await fetch(base + `/api/shops/catalogs?page=${page}`)).status, 400);
});

test('health checks the database and returns an unavailable status without exposing errors', async () => {
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
  const query = pool.query;
  pool.query = async () => { throw new Error('private database credentials'); };
  try {
    const unavailable = await fetch(base + '/api/health');
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { status: 'unavailable' });
  } finally { pool.query = query; }
});

test('login requires password and then a single-use SMS OTP before issuing a session', async () => {
  const first = await post('/api/auth/login', { phone: loginUser.phone, password: 'Password123' });
  assert.equal(first.status, 200);
  const challenge = await first.json();
  assert.equal(challenge.requires_otp, true);
  assert.equal(challenge.development_code, '654321');
  assert.equal(challenge.token, undefined);
  assert.ok(challenge.login_token);

  assert.equal((await post('/api/auth/login/verify', { phone: loginUser.phone, code: '000000', login_token: challenge.login_token })).status, 400);
  const verified = await post('/api/auth/login/verify', { phone: loginUser.phone, code: '654321', login_token: challenge.login_token });
  assert.equal(verified.status, 200);
  const session = await verified.json();
  assert.equal(jwt.verify(session.token, process.env.JWT_SECRET).userId, loginUser.id);
  assert.equal(session.user.user_type, 'customer');
  assert.equal((await post('/api/auth/login/verify', { phone: loginUser.phone, code: '654321', login_token: challenge.login_token })).status, 403);
});

test('production cannot grant paid accounts or billing changes using client payment references', async () => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const before = calls.length;
  try {
    assert.equal((await post('/api/auth/register-shop', { selected_plan: 'pro', payment_id: 'MOCK_PAY_1' })).status, 503);
    const response = await fetch(base + '/api/shops/1/subscription', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` },
      body: JSON.stringify({ action: 'change', plan: 'pro', payment_id: 'arbitrary-reference' }),
    });
    assert.equal(response.status, 503);
    const newQueries = calls.slice(before).filter(({ sql }) => !sql.includes('SELECT auth_version FROM users'));
    assert.equal(newQueries.length, 0);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
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

test('product create and edit reject blank, malformed and oversized prices', async () => {
  const update = body => fetch(base + '/api/products/1', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` }, body: JSON.stringify(body) });
  for (const price of ['', ' ', null, undefined, true, [], 100000000, -1]) {
    assert.equal((await post('/api/shops/1/products', { name: 'Rice', price }, true)).status, 400);
    assert.equal((await update({ name: 'Rice', price })).status, 400);
  }
  assert.equal((await update({ name: {}, price: 10 })).status, 400);
  assert.equal((await update({ name: 'Rice', price: 0, description: '', brand: '' })).status, 200);
  const clear = calls.findLast(call => call.sql.includes('UPDATE products p'));
  assert.equal(clear.values[1], null);
  assert.equal(clear.values[2], null);
  assert.deepEqual(clear.values.slice(8), [true, true]);
  assert.equal((await update({ name: 'Rice', price: '12.50' })).status, 200);
  assert.deepEqual(calls.findLast(call => call.sql.includes('UPDATE products p')).values.slice(8), [false, false]);
});

test('public portfolio rejects invalid ids and selects no billing fields', async () => {
  for (const id of ['abc', '-1', '1.5', '2147483648']) assert.equal((await fetch(base + `/api/shops/${id}/portfolio`)).status, 400);
  const response = await fetch(base + '/api/shops/1/portfolio');
  assert.equal(response.status, 200);
  const sql = calls.findLast(call => call.sql.includes('FROM shops s WHERE s.id')).sql;
  assert.doesNotMatch(sql, /s\.\*|payment_id|user_id|subscription/);
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
