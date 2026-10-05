// Temporary sharing only. Production continues to use backend/index.js directly.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('../backend/node_modules/express');
const pool = require('../backend/db');
const { mountSeo } = require('../backend/seo');
const stateFile = path.resolve(__dirname, '../.test-share/tunnel.json');
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
app.get('/robots.txt', (req, res) => res.type('text').send('User-agent: *\nDisallow: /\n'));
app.use((req, res, next) => {
  if (req.path !== '/api' && !req.path.startsWith('/api/')) return next();
  const upstream = http.request({ hostname: '127.0.0.1', port: 5000, path: req.originalUrl,
    method: req.method, headers: { ...req.headers, host: 'localhost:5000' } }, (reply) => {
    res.writeHead(reply.statusCode, { ...reply.headers, 'x-robots-tag': 'noindex, nofollow' });
    reply.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'Local backend unavailable.' }); else res.destroy(); });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
});
let router, activeOrigin;
app.use((req, res, next) => {
  let origin = 'http://localhost:5001';
  try {
    const { url } = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url)) origin = url;
  } catch { /* Startup before the tunnel publishes its URL. */ }
  if (origin !== activeOrigin) {
    router = express.Router();
    mountSeo(router, pool, { siteUrl: origin });
    activeOrigin = origin;
  }
  router(req, res, next);
});
app.use((req, res) => res.status(404).send('Page not found.'));
const server = app.listen(5001, '127.0.0.1', () => console.log('Temporary test preview ready on port 5001'));
server.on('error', async (error) => { console.error(error.message); await pool.end(); process.exitCode = 1; });
