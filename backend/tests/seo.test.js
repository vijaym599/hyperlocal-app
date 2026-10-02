const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mountSeo, shopPath, productPath } = require('../seo');

const shop = { id: 7, name: 'ABC Supermarket', address: 'Anna Nagar, Madurai', category: 'Grocery', phone: '+919876543210', latitude: 9.9, longitude: 78.1, opening_time: '09:00:00', closing_time: '21:00:00', average_rating: '4.5', review_count: 2 };
const product = { id: 12, shop_id: 7, name: 'Atta <script>alert(1)</script>', description: '</script><script>bad()</script>', price: '250.00', availability_status: 'out_of_stock', average_rating: '4', review_count: 1 };
let fail = false;
const pool = { query: async (sql, values) => {
  if (fail) throw new Error('offline');
  if (sql.includes('AS shops')) return { rows: [{ shops: 7, products: 12 }] };
  if (sql.includes('FROM shops s WHERE')) return { rows: values[0] === 7 ? [shop] : [] };
  if (sql.includes('FROM products p WHERE')) return { rows: values[0] === 12 ? [product] : [] };
  if (sql.includes('FROM products')) return { rows: sql.includes('JOIN shops') ? [{ ...product, address: shop.address }] : [product] };
  return { rows: [shop] };
} };
let server, base;
test.before(async () => {
  const app = express();
  mountSeo(app, pool, { siteUrl: 'https://nearbuy.example', dist: '/nonexistent-build' });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test('shop returns complete HTML, canonical, real ratings, daily hours and catalog links', async () => {
  const response = await fetch(base + shopPath(shop));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('<h1>ABC Supermarket</h1>'));
  assert.ok(html.includes('href="https://nearbuy.example' + shopPath(shop) + '"'));
  assert.ok(html.includes('Anna Nagar, Madurai'));
  const schema = JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)[1])[0];
  assert.equal(schema['@type'], 'LocalBusiness');
  assert.equal(schema.aggregateRating.reviewCount, 2);
  assert.equal(schema.openingHoursSpecification.opens, '09:00');
  assert.ok(html.includes(productPath(product, shop)));
});
test('product renders stock and price; HTML and JSON-LD escape user data', async () => {
  const response = await fetch(base + productPath(product, shop));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(html.includes('&lt;script&gt;'));
  const schema = JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)[1])[1];
  assert.equal(schema.name, product.name);
  assert.equal(schema.offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(schema.offers.price, 250);
});
test('old slugs redirect and missing records return real 404 with noindex', async () => {
  const redirect = await fetch(base + '/shop/old-name-7', { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), 'https://nearbuy.example' + shopPath(shop));
  const response = await fetch(base + '/product/missing-99');
  assert.equal(response.status, 404);
  assert.ok((await response.text()).includes('content="noindex"'));
});
test('directory, robots and sitemap use configured public origin and escaped links', async () => {
  assert.ok((await (await fetch(base + '/shops')).text()).includes(shopPath(shop)));
  assert.ok((await (await fetch(base + '/robots.txt')).text()).includes('Sitemap: https://nearbuy.example/sitemap.xml'));
  const index = await (await fetch(base + '/sitemap.xml')).text();
  assert.ok(index.includes('/sitemaps/products-1.xml'));
  const xml = await (await fetch(base + '/sitemaps/products-1.xml')).text();
  assert.ok(xml.includes('https://nearbuy.example' + productPath(product, shop)));
  assert.equal((await fetch(base + '/sitemaps/invalid.xml')).status, 404);
});
test('database failures return 503 and noindex', async () => {
  fail = true;
  try {
    const response = await fetch(base + shopPath(shop));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  } finally { fail = false; }
});
test('unsafe canonical origins are rejected', () => {
  assert.throws(() => mountSeo(express(), pool, { siteUrl: 'https://example.com/path' }), /SITE_URL/);
});
