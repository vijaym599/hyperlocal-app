const target = process.argv[2];
const allowHttp = process.argv.includes('--allow-http');
if (!target) throw new Error('Usage: npm run security:smoke -- https://staging.example.com');
const origin = new URL(target);
if (origin.pathname !== '/' || origin.search || origin.hash || (!allowHttp && origin.protocol !== 'https:')) throw new Error('Target must be an HTTPS origin without a path. Use --allow-http only for a local test.');

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const request = (path, options = {}) => fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
const requiredHeaders = {
  'content-security-policy': ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'"],
  'permissions-policy': ['camera=()', 'microphone=()'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
  'cross-origin-opener-policy': ['same-origin'],
};

const home = await request('/');
check(home.ok, `Homepage returned HTTP ${home.status}.`);
for (const [name, expected] of Object.entries(requiredHeaders)) {
  const actual = home.headers.get(name) || '';
  for (const value of expected) check(actual.includes(value), `${name} is missing ${value}.`);
}
check(!home.headers.get('x-powered-by'), 'x-powered-by exposes the framework.');
if (origin.protocol === 'https:') check((home.headers.get('strict-transport-security') || '').includes('max-age='), 'HSTS is missing on HTTPS.');

const health = await request('/api/health');
const healthBody = await health.json().catch(() => ({}));
check(health.ok && healthBody.status === 'ok', `Health endpoint is not healthy (HTTP ${health.status}).`);
check(Object.keys(healthBody).every((key) => key === 'status'), 'Health endpoint exposes more than the service status.');
check(Boolean(health.headers.get('x-request-id')), 'API responses do not include a request correlation ID.');

const marker = `secret-${Date.now()}`;
const missing = await request(`/api/security-probe-not-found?token=${marker}`);
const missingText = await missing.text();
check(missing.status === 404, `Unknown API route returned HTTP ${missing.status}, expected 404.`);
check(!missingText.includes(marker), '404 response reflects query-string data.');

const hostileOrigin = 'https://attacker.invalid';
const cors = await request('/api/health', { headers: { Origin: hostileOrigin } });
check(cors.headers.get('access-control-allow-origin') !== hostileOrigin, 'CORS allows an untrusted origin.');

if (failures.length) {
  console.error(`Security smoke failed with ${failures.length} finding(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Security smoke passed for ${origin.origin}: headers, health disclosure, request IDs, 404 reflection, and CORS.`);
}
