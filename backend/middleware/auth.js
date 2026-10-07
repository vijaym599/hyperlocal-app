const jwt = require('jsonwebtoken');
const { securityEvent } = require('../security');

const authenticate = (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    securityEvent(req, 'authentication_missing');
    return res.status(401).json({ error: 'Authentication is required for this action.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return res.status(500).json({ error: 'Authentication is not configured on the server.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(Number(req.user.userId)) || Number(req.user.userId) < 1) throw new Error('Invalid token subject.');
    req.user.userId = Number(req.user.userId);
    return next();
  } catch {
    securityEvent(req, 'authentication_invalid');
    return res.status(401).json({ error: 'Your session is invalid or has expired. Please sign in again.' });
  }
};

const withAccountValidation = (pool) => (req, res, next) => authenticate(req, res, async () => {
  try {
    const result = await pool.query('SELECT auth_version FROM users WHERE id = $1', [req.user.userId]);
    const account = result.rows[0];
    const tokenVersion = Number(req.user.authVersion || 1);
    if (!account || Number(account.auth_version || 1) !== tokenVersion) {
      return res.status(401).json({ error: 'This session has been signed out. Please sign in again.' });
    }
    return next();
  } catch (error) {
    console.error('Account session validation failed:', error.message);
    return res.status(503).json({ error: 'Unable to validate this session.' });
  }
});

module.exports = authenticate;
module.exports.withAccountValidation = withAccountValidation;
