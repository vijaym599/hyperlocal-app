const { randomUUID } = require('node:crypto');

const requestId = (req, res, next) => {
  const id = randomUUID();
  req.requestId = id;
  res.set('X-Request-ID', id);
  next();
};

const securityHeaders = (req, res, next) => {
  const production = process.env.NODE_ENV === 'production';
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    ...(production ? ['upgrade-insecure-requests'] : []),
  ];
  res.set({
    'Content-Security-Policy': directives.join('; '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), payment=(), geolocation=(self)',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  if (production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if ((req.path.startsWith('/api/') && req.get('authorization')) || req.path.startsWith('/api/auth/')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
};

const securityEvent = (req, event, detail = {}) => {
  console.warn(JSON.stringify({
    level: 'security', event, request_id: req.requestId, method: req.method,
    path: req.path, timestamp: new Date().toISOString(), ...detail,
  }));
};

// Record successful, state-changing administrator actions without persisting
// request bodies, credentials, query strings, or other potentially sensitive
// input. This is mounted before routes so it also covers admin routes declared
// by feature modules.
const adminAudit = (pool) => (req, res, next) => {
  if (!req.path.startsWith('/api/admin/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400 || !Number.isSafeInteger(req.user?.userId)) return;
    const routePath = typeof req.route?.path === 'string' ? req.route.path : req.path;
    const targetId = Object.values(req.params || {}).find((value) => /^[1-9]\d*$/.test(String(value))) || null;
    void pool.query(
      `INSERT INTO admin_audit_logs
        (actor_user_id,request_id,method,route_path,status_code,target_id,ip_address,user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.user.userId, req.requestId, req.method, routePath, res.statusCode, targetId, req.ip, String(req.get('user-agent') || '').slice(0, 500) || null]
    ).catch((error) => console.error(`Admin audit write failed [${req.requestId}]:`, error.message));
  });
  return next();
};

const notFound = (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.', request_id: req.requestId });
  return res.status(404).json({ error: 'Page not found.', request_id: req.requestId });
};

const handleError = (error, req, res, next) => {
  const tooLarge = error?.type === 'entity.too.large';
  const badJson = error instanceof SyntaxError && error?.type === 'entity.parse.failed';
  if (!tooLarge && !badJson) console.error(`Unhandled request error [${req.requestId}]:`, error?.message || 'Unknown error');
  if (res.headersSent) return next(error);
  if (tooLarge) return res.status(413).json({ error: 'Request body is too large.', request_id: req.requestId });
  if (badJson) return res.status(400).json({ error: 'Request body must contain valid JSON.', request_id: req.requestId });
  return res.status(500).json({ error: 'An unexpected server error occurred.', request_id: req.requestId });
};

module.exports = { requestId, securityHeaders, securityEvent, adminAudit, notFound, handleError };
