const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAssistantQuery, assistantAnswer, mountCustomerAssistant } = require('../customerAssistant');

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

test('assistant endpoint performs one read-only catalog query', async () => {
  let route;
  const app = { post: (path, ...handlers) => { route = { path, handler: handlers.at(-1) }; } };
  const calls = [];
  const pool = { query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ id: 1, name: 'Milk', price: '55.00', availability_status: 'available', distance_km: '1.2' }] };
  } };
  mountCustomerAssistant(app, pool);
  assert.equal(route.path, '/api/ai/customer-assistant');
  const response = { code: 200, body: null, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await route.handler({ body: { message: 'milk under 100 near me', lat: 13.08, lng: 80.27 } }, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.read_only, true);
  assert.equal(response.body.products.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql.trim(), /^WITH assistant_candidates AS/i);
  assert.doesNotMatch(calls[0].sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
});

test('assistant response clearly reports an empty catalog result', () => {
  assert.match(assistantAnswer({ terms: ['rice'], budget: 100, radiusKm: 5 }, []), /couldn't find/i);
});

test('assistant explains when it expands an implicit nearby search', () => {
  const answer = assistantAnswer(
    { terms: ['rice'], budget: null, radiusKm: 25, explicitRadius: false },
    [{ distance_km: '161.0', availability_status: 'available' }]
  );
  assert.match(answer, /closest live matches/i);
  assert.match(answer, /161\.0 km/i);
});
