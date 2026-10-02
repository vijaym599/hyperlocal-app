import assert from 'node:assert/strict';

const site = new URL(process.argv[2] || process.env.SITE_URL || 'http://localhost:5000');
assert.ok(['http:', 'https:'].includes(site.protocol), 'Use an HTTP(S) site URL.');
assert.equal(site.pathname, '/', 'Use a site origin without a path.');
assert.ok(!site.username && !site.password && !site.search && !site.hash, 'Use an origin without credentials, query or hash.');
const read = async (path) => {
  const response = await fetch(new URL(path, site), { signal: AbortSignal.timeout(20000), redirect: 'manual' });
  assert.equal(response.status, 200, `${path}: expected HTTP 200, got ${response.status}`);
  return response;
};
assert.equal((await (await read('/api/health')).json()).status, 'ok');
const home = await (await read('/')).text();
assert.match(home, /id="root"/);
const asset = /(?:src|href)="(\/assets\/[^"<>]+)"/.exec(home);
assert.ok(asset, 'Homepage must reference a built Vite asset.');
await read(asset[1]);
const robots = await (await read('/robots.txt')).text();
assert.match(robots, /Sitemap:/);
assert.ok(!/Disallow:\s*\/\s*(?:\n|$)/.test(robots), 'Public site must allow indexing.');
assert.match(await (await read('/sitemap.xml')).text(), /<sitemapindex/);
await read('/shops');
assert.equal((await fetch(new URL('/product/missing-2147483647', site), { signal: AbortSignal.timeout(20000) })).status, 404);
console.log('Smoke checks passed: database health, homepage, asset, robots, sitemap, shop directory, missing product.');
