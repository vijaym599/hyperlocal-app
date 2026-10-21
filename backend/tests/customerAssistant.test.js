const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAssistantQuery, assistantAnswer, mountCustomerAssistant, relatedTermsFor, selectAssistantResults } = require('../customerAssistant');

test('assistant understands English, Tanglish and Tamil shopping constraints', () => {
  const english = parseAssistantQuery('Show basmati rice under ₹500 within 8 km');
  assert.deepEqual(english.terms, ['basmati', 'rice']);
  assert.equal(english.budget, 500);
  assert.equal(english.radiusKm, 8);

  const tanglish = parseAssistantQuery('300 rs kulla milk enaku pakkathula venum');
  assert.deepEqual(tanglish.terms, ['milk']);
  assert.equal(tanglish.budget, 300);

  const tamil = parseAssistantQuery('₹200 கீழ் அரிசி அருகில் காட்டு');
  assert.ok(tamil.terms.includes('rice'));
  assert.equal(tamil.budget, 200);
  assert.equal(tamil.explicitRadius, false);
});

test('assistant ranks exact, typo and related catalog matches without inventing products', () => {
  const candidates = [
    { id: 1, name: 'Basmati Rice', brand: 'Harvest', description: 'Long grain', shop_name: 'Fresh Mart', shop_category: 'Grocery', price: '120', availability_status: 'available', distance_km: '2', is_open: true, is_verified: true, product_average_rating: '4.5' },
    { id: 2, name: 'Rice Flour', brand: 'Home', description: 'Fine flour', shop_name: 'Fresh Mart', shop_category: 'Grocery', price: '60', availability_status: 'available', distance_km: '1', is_open: true, is_verified: true, product_average_rating: '4.0' },
    { id: 3, name: 'Plain Curd', brand: 'Farm', description: 'Fresh dairy cup', shop_name: 'Daily Needs', shop_category: 'Dairy', price: '45', availability_status: 'available', distance_km: '1.5', is_open: true, is_verified: false, product_average_rating: '4.2' },
  ];
  const exact = selectAssistantResults({ terms: ['rice'] }, candidates);
  assert.equal(exact.matchType, 'exact');
  assert.deepEqual(exact.products.map((product) => product.id), [2, 1]);
  const typo = selectAssistantResults({ terms: ['basmti'] }, candidates);
  assert.equal(typo.matchType, 'similar');
  assert.equal(typo.products[0].id, 1);
  assert.equal(selectAssistantResults({ terms: ['basmti', 'rice'] }, candidates).matchType, 'similar');
  const related = selectAssistantResults({ terms: ['milk'] }, candidates);
  assert.equal(related.matchType, 'related');
  assert.equal(related.products[0].id, 3);
  assert.ok(relatedTermsFor(['milk']).includes('dairy'));
  assert.ok(relatedTermsFor(['toothbrush']).includes('toothpaste'));
});

test('assistant does not present unrelated nearby products as matches', () => {
  const selection = selectAssistantResults({ terms: ['umbrella'] }, [
    { id: 4, name: 'Notebook', brand: '', description: '', shop_name: 'Stationery', shop_category: 'Books', price: '30', availability_status: 'available', distance_km: '1', is_open: true, is_verified: false, product_average_rating: '0' },
  ]);
  assert.equal(selection.matchType, 'none');
  assert.equal(selection.products.length, 0);
  assert.match(assistantAnswer({ terms: ['umbrella'], budget: null, radiusKm: 25, explicitRadius: true }, selection.products, selection.matchType), /exact or related/i);
});

test('assistant never treats a shop name or category as a matching product', () => {
  const selection = selectAssistantResults({ terms: ['mobile'] }, [
    { id: 5, name: 'Rice', brand: '', description: 'Premium grain', shop_name: 'Mobile Store', shop_category: 'Mobile', price: '80', availability_status: 'available', distance_km: '1', is_open: true, is_verified: true, product_average_rating: '4.8' },
  ]);
  assert.equal(selection.matchType, 'none');
  assert.deepEqual(selection.products, []);
});

test('assistant returns only genuine semantic product-family matches', () => {
  const selection = selectAssistantResults({ terms: ['mobile'] }, [
    { id: 6, name: 'Android Smartphone', brand: 'Acme', description: '5G phone', shop_name: 'Electronics Hub', shop_category: 'Electronics', price: '12000', availability_status: 'available', distance_km: '3', is_open: true, is_verified: true, product_average_rating: '4.3' },
    { id: 7, name: 'Ponni Rice', brand: 'Farm', description: 'Premium grain', shop_name: 'Mobile Bazaar', shop_category: 'Grocery', price: '70', availability_status: 'available', distance_km: '1', is_open: true, is_verified: true, product_average_rating: '4.9' },
  ]);
  assert.equal(selection.matchType, 'related');
  assert.deepEqual(selection.products.map((product) => product.id), [6]);
});

test('assistant endpoint performs bounded read-only catalog and image queries', async () => {
  let route;
  const app = { post: (path, ...handlers) => { route = { path, handler: handlers.at(-1) }; } };
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT id, image_url FROM products/i.test(sql)) return { rows: [{ id: 1, image_url: 'https://example.test/milk.webp' }] };
    return { rows: [{ id: 1, name: 'Milk', price: '55.00', availability_status: 'available', distance_km: '1.2' }] };
  } };
  mountCustomerAssistant(app, pool);
  assert.equal(route.path, '/api/ai/customer-assistant');
  const response = { code: 200, body: null, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await route.handler({ body: { message: 'milk under 100 near me', lat: 13.08, lng: 80.27 } }, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.read_only, true);
  assert.equal(response.body.products.length, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql.trim(), /^WITH assistant_candidates AS/i);
  assert.match(calls[0].sql, /LIMIT \$6/i);
  for (const call of calls) assert.doesNotMatch(call.sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  assert.equal(response.body.match_type, 'exact');
  assert.equal(response.body.products[0].image_url, 'https://example.test/milk.webp');
});

test('assistant response clearly reports an empty catalog result', () => {
  assert.match(assistantAnswer({ terms: ['rice'], budget: 100, radiusKm: 5 }, []), /couldn't find/i);
});

test('assistant explains when it expands an implicit nearby search', () => {
  const answer = assistantAnswer(
    { terms: ['rice'], budget: null, radiusKm: 25, explicitRadius: false },
    [{ distance_km: '161.0', availability_status: 'available' }]
  );
  assert.match(answer, /expanded the search/i);
  assert.match(answer, /161\.0 km/i);
});
