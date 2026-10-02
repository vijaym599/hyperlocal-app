const test = require('node:test');
const assert = require('node:assert/strict');
const { databaseConfig, validateProduction, trustProxy } = require('../production');

const production = {
  NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(64), SITE_URL: 'https://nearbuy.test',
  DATABASE_URL: 'postgresql://owner:secret@db.test/nearbuy',
  GEOCODER_USER_AGENT: 'Nearbuy/1.0 (support@nearbuy.test)',
};
test('production rejects missing secrets, example domains and incomplete database setup', () => {
  assert.doesNotThrow(() => validateProduction(production));
  for (const change of [
    { JWT_SECRET: 'short' }, { SITE_URL: 'https://yourdomain.in' },
    { SITE_URL: 'http://nearbuy.test' }, { SITE_URL: 'https://nearbuy.test/path' },
    { DATABASE_URL: '' }, { GEOCODER_USER_AGENT: 'Nearbuy/1.0 (support@example.com)' },
  ]) assert.throws(() => validateProduction({ ...production, ...change }));
  assert.doesNotThrow(() => validateProduction({ NODE_ENV: 'development' }));
});
test('database supports hosted URL and verified TLS without silently overriding the CA', () => {
  const config = databaseConfig({ DATABASE_URL: production.DATABASE_URL, DB_SSL: 'true', DB_SSL_CA: 'line1\\nline2' });
  assert.equal(config.connectionString, production.DATABASE_URL);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true, ca: 'line1\nline2' });
  assert.throws(() => databaseConfig({ DATABASE_URL: production.DATABASE_URL + '?sslmode=require', DB_SSL: 'true' }));
  assert.equal(databaseConfig({ DB_HOST: 'localhost' }).host, 'localhost');
  assert.equal(databaseConfig({}).ssl, undefined);
});
test('proxy trust defaults to direct access and rejects unrestricted trust', () => {
  assert.equal(trustProxy(), false);
  assert.equal(trustProxy('false'), false);
  assert.equal(trustProxy('1'), 1);
  assert.deepEqual(trustProxy('loopback, 10.0.0.0/8'), ['loopback', '10.0.0.0/8']);
  assert.throws(() => trustProxy('true'));
});
