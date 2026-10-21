const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Stub the database before loading the API: tests never import db.js or use .env.
const calls = [];
let shopSubscriptionActive = true;
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
    if (sql.includes('SELECT user_type, is_admin FROM users')) return { rows: [{ user_type: 'customer', is_admin: false }] };
    if (sql.includes('INSERT INTO user_activities')) return { rows: [] };
    if (sql.includes("COUNT(*) FILTER (WHERE action_type = 'view')")) return { rows: [{ views: 3, unique_viewers: 2, directions: 1, calls: 1, whatsapp_messages: 1, reviews: 1, product_views: 2, favorites: 1, shares: 1, searches: 1, total_interactions: 12 }] };
    if (sql.includes('FROM shop_reviews sr') && sql.includes('UNION ALL')) return { rows: [{ id: 1, target: 'shop', rating: 5, comment: 'Helpful shop', owner_name: 'Customer' }] };
    if (sql.startsWith('SELECT id, latitude, longitude FROM shops')) return { rows: [{ id: 1, latitude: 13.08, longitude: 80.27 }] };
    if (sql.includes('WITH nearby AS')) return { rows: [{ id: 8, requested_product: 'Rice', distance_km: '2.1', radius_km: '5', status: 'new', total_count: 1 }] };
    if (sql.includes('SELECT s.id, s.name FROM shops s') && sql.includes('EXISTS')) return { rows: [{ id: 1, name: 'Test shop' }] };
    if (sql.includes('AS product_count')) return { rows: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Shop ${i + 1}`, product_count: 2 })) };
    if (sql.includes('WITH ranked_products')) return { rows: searchProducts.slice(values[7], values[7] + values[6]) };
    if (sql.includes('INSERT INTO product_requests')) return { rows: [{ id: 1 }] };
    if (sql.includes("SET availability_status='out_of_stock'")) return { rows: [] };
    if (sql.includes('subscription_ends_at > CURRENT_TIMESTAMP AS subscription_active') && sql.includes('FROM products p')) return { rows: [{ id: 1, subscription_active: shopSubscriptionActive }] };
    if (sql.includes('subscription_ends_at > CURRENT_TIMESTAMP AS subscription_active') && sql.includes('FROM shop_offers o')) return { rows: [{ id: 1, subscription_active: shopSubscriptionActive }] };
    if (sql.includes('subscription_ends_at > CURRENT_TIMESTAMP AS subscription_active') && sql.includes('FROM shops')) return { rows: [{ id: 1, subscription_plan: 'pro', subscription_active: shopSubscriptionActive }] };
    if (sql.includes('SELECT subscription_plan')) return { rows: [{ subscription_plan: 'pro' }] };
    if (sql.includes('SET availability_status = COALESCE($1::varchar')) return { rows: (values[2] || [1, 2]).map((id) => ({ id, availability_status: values[0] || 'available' })) };
    if (sql.includes('UPDATE products p')) return { rows: [{ id: 1, name: values[0], description: values[1], brand: values[2], price: values[3] }] };
    if (sql.startsWith('UPDATE shops') && sql.includes('whatsapp_number = $8')) return { rows: [{ id: 1, name: values[0], category: values[1], phone: values[6], whatsapp_number: values[7] }] };
    if (sql.includes('SELECT s.id, s.name, s.category')) return { rows: [{ id: 1, name: 'Test shop' }] };
    if (sql.includes('COUNT(*) OVER()::int AS total_count') && sql.includes('FROM products p JOIN shops s')) {
      const products = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, name: `Catalog product ${index + 1}`, total_count: 30, available_count: 18, low_stock_count: 6, out_of_stock_count: 4, unconfirmed_count: 2 }));
      return { rows: products.slice(values[2], values[2] + values[1]) };
    }
    if (sql.includes('COUNT(*)')) return { rows: [{ count: 0 }] };
    if (sql.includes('SELECT id FROM shops')) return { rows: [{ id: 1 }] };
    return { rows: [] };
  },
  connect: async () => ({ query: (...args) => pool.query(...args), release: () => {} }),
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
  const firstResponse = await fetch(base + '/api/search/products?lat=13&lng=80');
  const first = await firstResponse.json();
  assert.equal(first.results.length, 10);
  assert.equal(first.radius_km, 5000);
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
  const sql = calls.findLast(call => call.sql.includes('WITH ranked_products')).sql;
  assert.match(sql, /CASE WHEN subscription_active THEN 0 ELSE 1 END/);
  assert.match(sql, /THEN 'unconfirmed'/);
  assert.match(sql, /AS stock_freshness/);
  assert.equal(calls.find(call => call.sql.includes('WITH ranked_products')).values[3], 5000);
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

test('login issues a session using only a valid phone number and password', async () => {
  assert.equal((await post('/api/auth/login', { phone: loginUser.phone, password: 'WrongPassword1' })).status, 401);
  const response = await post('/api/auth/login', { phone: loginUser.phone, password: 'Password123' });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(jwt.verify(session.token, process.env.JWT_SECRET).userId, loginUser.id);
  assert.equal(session.user.user_type, 'customer');
  assert.equal(session.requires_otp, undefined);
});

test('authentication responses are never cacheable', async () => {
  const response = await post('/api/auth/login', { phone: loginUser.phone, password: 'WrongPassword1' });
  assert.match(response.headers.get('cache-control') || '', /no-store/);
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
  const response = await post('/api/product-requests', { requested_product: 'Rice', customer_phone: '9876543210', radius_km: 5 });
  assert.equal(response.status, 201);
  assert.equal(calls.at(-1).values[4], 5);
  assert.equal(calls.at(-1).values[1], '+919876543210');
});

test('guest and signed-in customer interactions are recorded with anonymous visitor identity', async () => {
  const visitorId = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal((await post('/api/activity/view', { shop_id: 1 })).status, 400);
  const guest = await post('/api/activity/product_view', { shop_id: 1, product_id: 4, visitor_id: visitorId, source: 'nearby-search' });
  assert.equal(guest.status, 201);
  const guestInsert = calls.findLast(call => call.sql.includes('INSERT INTO user_activities'));
  assert.deepEqual(guestInsert.values.slice(0, 5), [null, visitorId, 'product_view', 1, 4]);

  const customer = await post('/api/activity/favorite', { shop_id: 1, product_id: 4, visitor_id: visitorId }, true);
  assert.equal(customer.status, 201);
  const customerInsert = calls.findLast(call => call.sql.includes('INSERT INTO user_activities'));
  assert.deepEqual(customerInsert.values.slice(0, 5), [1, visitorId, 'favorite', 1, 4]);
});

test('every shop plan can load complete activity insights and nearby demand', async () => {
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` };
  const beforeInsights = calls.length;
  const insightsResponse = await fetch(base + '/api/shops/1/insights?period=total', { headers });
  assert.equal(insightsResponse.status, 200);
  const insights = await insightsResponse.json();
  assert.equal(insights.insights.product_views, 2);
  assert.equal(insights.insights.total_interactions, 12);
  assert.equal(insights.latest_reviews[0].comment, 'Helpful shop');
  assert.equal(calls.slice(beforeInsights).some(call => call.sql.includes('SELECT subscription_plan')), false);

  const demandResponse = await fetch(base + '/api/shops/1/product-requests', { headers });
  assert.equal(demandResponse.status, 200);
  const demand = await demandResponse.json();
  assert.equal(demand.requests[0].requested_product, 'Rice');
  assert.equal(demand.total, 1);
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

test('product creates lock the owned shop before enforcing plan limits', async () => {
  calls.length = 0;
  assert.equal((await post('/api/shops/1/products', { name: 'Rice', price: 10 }, true)).status, 201);
  const lock = calls.find((call) => call.sql.includes('FROM shops WHERE id=$1 AND user_id=$2 FOR UPDATE'));
  assert.ok(lock, 'the shop row must be locked before counting products');
  assert.ok(calls.find((call) => call.sql === 'BEGIN'));
  assert.ok(calls.find((call) => call.sql === 'COMMIT'));
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
  assert.equal((await update({ name: 'Rice', price: 10, description: 'x'.repeat(2001) })).status, 400);
  assert.equal((await update({ name: 'Rice', price: 10, image_url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await update({ name: 'Rice', price: 10, image_url: 'data:text/html;base64,PHNjcmlwdD4=' })).status, 400);
  assert.equal((await update({ name: 'Rice', price: 10, image_url: 'data:image/png;base64,PHNjcmlwdD4=' })).status, 400);
});

test('shop contact requires call or WhatsApp and allows either number to be cleared', async () => {
  const updateShop = body => fetch(base + '/api/shops/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` },
    body: JSON.stringify({ name: 'Test shop', category: 'Grocery & Supermarket', ...body }),
  });
  const missing = await updateShop({ phone: '', whatsapp_number: '' });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /at least one customer contact/i);

  const whatsappOnly = await updateShop({ phone: '', whatsapp_number: '9876543210' });
  assert.equal(whatsappOnly.status, 200);
  const whatsappUpdate = calls.findLast(call => call.sql.startsWith('UPDATE shops'));
  assert.equal(whatsappUpdate.values[6], null);
  assert.equal(whatsappUpdate.values[7], '+919876543210');

  const callOnly = await updateShop({ phone: '9123456789', whatsapp_number: '' });
  assert.equal(callOnly.status, 200);
  const callUpdate = calls.findLast(call => call.sql.startsWith('UPDATE shops'));
  assert.equal(callUpdate.values[6], '+919123456789');
  assert.equal(callUpdate.values[7], null);
});

test('shop updates reject unsafe or credential-bearing map links', async () => {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` };
  const update = (google_map_link) => fetch(base + '/api/shops/1', {
    method: 'PUT', headers, body: JSON.stringify({ name: 'Test shop', category: 'Grocery & Supermarket', phone: '9876543210', google_map_link })
  });
  assert.equal((await update('javascript:alert(1)')).status, 400);
  assert.equal((await update('https://user:password@example.com/map')).status, 400);
  assert.equal((await update('https://maps.google.com/?q=Chennai')).status, 200);
  const invalidDetails = await fetch(base + '/api/shops/1', {
    method: 'PUT', headers, body: JSON.stringify({ name: 'Test shop', category: 'Grocery & Supermarket', phone: '9876543210', latitude: 91, opening_time: '29:99' })
  });
  assert.equal(invalidDetails.status, 400);
});

test('expired shop subscriptions allow billing only and block owner dashboard APIs', async () => {
  shopSubscriptionActive = false;
  try {
    const authHeaders = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` };
    const updateProduct = await fetch(base + '/api/products/1', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` }, body: JSON.stringify({ name: 'Rice', price: 10 }) });
    assert.equal(updateProduct.status, 403);
    assert.match((await updateProduct.json()).error, /subscription has expired/i);
    const addProduct = await post('/api/shops/1/products', { name: 'Rice', price: 10 }, true);
    assert.equal(addProduct.status, 403);
    const offer = await post('/api/shops/1/offers', { title: 'Sale' }, true);
    assert.equal(offer.status, 403);
    const updateShop = await fetch(base + '/api/shops/1', { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test shop', category: 'Grocery & Supermarket', phone: '9876543210' }) });
    assert.equal(updateShop.status, 403);
    const updateStatus = await fetch(base + '/api/shops/1/open-status', { method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: true }) });
    assert.equal(updateStatus.status, 403);
    for (const path of ['/api/shops/1/offers', '/api/shops/1/insights', '/api/shops/1/product-requests', '/api/shops/1/notifications']) {
      const response = await fetch(base + path, { headers: authHeaders });
      assert.equal(response.status, 403, `${path} should be subscription protected`);
    }
    const markNotifications = await fetch(base + '/api/shops/1/notifications/read', { method: 'PATCH', headers: authHeaders });
    assert.equal(markNotifications.status, 403);
    const billingQueue = await fetch(base + '/api/shops/1/subscription-queue', { headers: authHeaders });
    assert.equal(billingQueue.status, 200, 'billing must remain available for renewal');
  } finally { shopSubscriptionActive = true; }
});

test('public portfolio rejects invalid ids and selects no billing fields', async () => {
  for (const id of ['abc', '-1', '1.5', '2147483648']) assert.equal((await fetch(base + `/api/shops/${id}/portfolio`)).status, 400);
  assert.equal((await fetch(base + '/api/shops/1/portfolio?limit=25')).status, 400);
  const response = await fetch(base + '/api/shops/1/portfolio');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.products.length, 24);
  assert.deepEqual(body.pagination, { total: 30, page: 1, page_size: 24, has_more: true, next_page: 2 });
  assert.equal(Object.hasOwn(body.products[0], 'total_count'), false);
  const sql = calls.findLast(call => call.sql.includes('FROM shops s WHERE s.id')).sql;
  assert.doesNotMatch(sql, /s\.\*|payment_id|user_id|subscription/);
});

test('shop products use bounded pagination and retain aggregate inventory counts', async () => {
  assert.equal((await fetch(base + '/api/shops/1/products?page=0')).status, 400);
  assert.equal((await fetch(base + '/api/shops/1/products?limit=25')).status, 400);
  const response = await fetch(base + '/api/shops/1/products?page=2&limit=10');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.products.length, 10);
  assert.equal(body.products[0].id, 11);
  assert.equal(body.total, 30);
  assert.equal(body.next_page, 3);
  assert.deepEqual(body.stock_counts, { available: 18, low_stock: 6, out_of_stock: 4, unconfirmed: 2 });
  assert.equal(Object.hasOwn(body.products[0], 'available_count'), false);
  const catalogQuery = calls.findLast(call => call.sql.includes('FROM products p JOIN shops s'));
  assert.deepEqual(catalogQuery.values, [1, 11, 10]);
  assert.match(catalogQuery.sql, /THEN 'unconfirmed'/);
  assert.match(catalogQuery.sql, /AS stock_valid_until/);
});

test('owners can confirm the catalog once or bulk update selected stock', async () => {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET)}` };
  const confirm = await fetch(base + '/api/shops/1/products/stock', { method: 'PATCH', headers, body: JSON.stringify({ action: 'confirm' }) });
  assert.equal(confirm.status, 200);
  assert.equal((await confirm.json()).updated_count, 2);

  const selected = await fetch(base + '/api/shops/1/products/stock', { method: 'PATCH', headers, body: JSON.stringify({ action: 'set_status', availability_status: 'low_stock', product_ids: [4, 9] }) });
  assert.equal(selected.status, 200);
  const selectedBody = await selected.json();
  assert.equal(selectedBody.updated_count, 2);
  const update = calls.findLast((call) => call.sql.includes('SET availability_status = COALESCE($1::varchar'));
  assert.deepEqual(update.values, ['low_stock', 1, [4, 9]]);

  const invalid = await fetch(base + '/api/shops/1/products/stock', { method: 'PATCH', headers, body: JSON.stringify({ action: 'set_status', availability_status: 'available', product_ids: [] }) });
  assert.equal(invalid.status, 400);
});

test('expensive anonymous catalog routes are rate limited', async () => {
  let limited;
  for (let attempt = 0; attempt < 121 && !limited; attempt += 1) {
    const response = await fetch(base + '/api/explore');
    if (response.status === 429) limited = response;
  }
  assert.equal(limited?.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
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
