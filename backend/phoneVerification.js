const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PASSWORD_REQUIREMENT, isStrongPassword } = require('./passwordPolicy');

const normalizePhone = (value) => {
  const compact = String(value || '').trim().replace(/[\s().-]/g, '');
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
};
const isValidPhone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);
const failure = (status, message) => Object.assign(new Error(message), { status });
const twilioUrl = (serviceSid, resource) => `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/${resource}`;

function providerConfig(env = process.env) {
  const provider = String(env.PHONE_OTP_PROVIDER || '').toLowerCase();
  if (provider === 'development') {
    if (env.NODE_ENV === 'production') throw failure(503, 'Phone verification is not configured.');
    return { provider, code: String(env.DEVELOPMENT_OTP_CODE || '123456') };
  }
  if (provider !== 'twilio') throw failure(503, 'SMS phone verification is not configured yet.');
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) throw failure(503, 'SMS phone verification is not configured yet.');
  return { provider, accountSid, authToken, serviceSid };
}

async function twilioRequest(config, resource, fields) {
  const response = await fetch(twilioUrl(config.serviceSid, resource), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (resource === 'VerificationCheck' && response.status === 404) return { status: 'expired' };
    console.error(`SMS verification provider failed with HTTP ${response.status}.`);
    throw failure(response.status === 429 ? 429 : 502, response.status === 429 ? 'Too many verification attempts. Try again later.' : 'Unable to send or verify the SMS code right now.');
  }
  return data;
}

async function startVerification(phone, env = process.env) {
  const normalized = normalizePhone(phone);
  if (!/^\+91[6-9]\d{9}$/.test(normalized)) throw failure(400, 'Enter a valid 10-digit Indian mobile number.');
  const config = providerConfig(env);
  if (config.provider === 'development') return { phone: normalized, status: 'pending', developmentCode: config.code };
  const result = await twilioRequest(config, 'Verifications', { To: normalized, Channel: 'sms' });
  return { phone: normalized, status: result.status || 'pending' };
}

async function checkVerification(phone, code, env = process.env) {
  const normalized = normalizePhone(phone);
  const cleanCode = String(code || '').trim();
  if (!isValidPhone(normalized) || !/^\d{4,10}$/.test(cleanCode)) throw failure(400, 'Enter the phone number and verification code.');
  const config = providerConfig(env);
  if (config.provider === 'development') return cleanCode === config.code;
  const result = await twilioRequest(config, 'VerificationCheck', { To: normalized, Code: cleanCode });
  return result.status === 'approved';
}

async function initPhoneVerification(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS phone_verification_claims (
    id UUID PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS phone_verification_claims_expiry_idx ON phone_verification_claims(expires_at);`);
}

async function issuePurposeToken(pool, phone, purpose, env = process.env) {
  if (!env.JWT_SECRET) throw failure(500, 'Authentication is not configured on the server.');
  const id = randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query('DELETE FROM phone_verification_claims WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL \'1 day\'');
  await pool.query('INSERT INTO phone_verification_claims(id,phone,expires_at) VALUES($1,$2,$3)', [id, phone, expiresAt]);
  const token = jwt.sign({ purpose, phone, jti: id }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  return { token, expiresAt };
}

const issueVerificationToken = (pool, phone, env = process.env) => issuePurposeToken(pool, phone, 'phone_signup', env);
const issuePasswordResetToken = (pool, phone, env = process.env) => issuePurposeToken(pool, phone, 'password_reset', env);
const issuePasswordChangeToken = (pool, phone, env = process.env) => issuePurposeToken(pool, phone, 'password_change', env);

function verifyPurposeToken(token, phone, purpose, env = process.env) {
  if (!token || !env.JWT_SECRET) throw failure(403, 'Verification expired or is invalid. Send a new code.');
  let claim;
  try { claim = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { throw failure(403, 'Verification expired or is invalid. Send a new code.'); }
  if (claim.purpose !== purpose || claim.phone !== phone || !claim.jti) throw failure(403, 'Verification expired or is invalid. Send a new code.');
  return claim;
}

async function consumeVerificationToken(client, token, phone, env = process.env) {
  const claim = verifyPurposeToken(token, phone, 'phone_signup', env);
  const result = await client.query(`UPDATE phone_verification_claims SET consumed_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND phone=$2 AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING id`, [claim.jti, phone]);
  if (!result.rows.length) throw failure(403, 'Phone verification was already used or has expired. Send a new code.');
}

async function consumePasswordChangeToken(client, token, phone, env = process.env) {
  const claim = verifyPurposeToken(token, phone, 'password_change', env);
  const result = await client.query(`UPDATE phone_verification_claims SET consumed_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND phone=$2 AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING id`, [claim.jti, phone]);
  if (!result.rows.length) throw failure(403, 'Password verification was already used or has expired. Send a new code.');
}

async function resetPasswordWithToken(pool, token, phone, passwordHash, env = process.env) {
  const claim = verifyPurposeToken(token, phone, 'password_reset', env);
  const result = await pool.query(`WITH consumed AS (
      UPDATE phone_verification_claims SET consumed_at=CURRENT_TIMESTAMP
      WHERE id=$1 AND phone=$2 AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP
      RETURNING id
    )
    UPDATE users SET password=$3,password_changed_at=CURRENT_TIMESTAMP,auth_version=auth_version+1
    WHERE phone=$2 AND EXISTS (SELECT 1 FROM consumed) RETURNING id`, [claim.jti, phone, passwordHash]);
  if (!result.rows.length) throw failure(403, 'Verification was already used or has expired. Send a new code.');
}

function mountPhoneVerification(app, pool, rateLimit) {
  const phoneSendLimits = new Map();
  const resetSendLimits = new Map();
  app.post('/api/auth/phone-verification/start', rateLimit(5, 60 * 60 * 1000, 'phone-otp-start'), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      if (!/^\+91[6-9]\d{9}$/.test(phone)) throw failure(400, 'Enter a valid 10-digit Indian mobile number.');
      const now = Date.now();
      const attempt = phoneSendLimits.get(phone);
      if (attempt && now < attempt.nextAt) throw failure(429, 'Wait one minute before requesting another code.');
      if (attempt && now < attempt.resetAt && attempt.count >= 5) throw failure(429, 'Too many codes were sent to this number. Try again later.');
      const updated = !attempt || now >= attempt.resetAt ? { count: 1, resetAt: now + 60 * 60 * 1000, nextAt: now + 60 * 1000 }
        : { ...attempt, count: attempt.count + 1, nextAt: now + 60 * 1000 };
      phoneSendLimits.set(phone, updated);
      if (phoneSendLimits.size > 1000) for (const [key, value] of phoneSendLimits) if (value.resetAt <= now) phoneSendLimits.delete(key);
      if ((await pool.query('SELECT id FROM users WHERE phone=$1', [phone])).rows.length) throw failure(409, 'This phone number is already registered. Please sign in.');
      const result = await startVerification(phone);
      res.json({ message: 'Verification code sent by SMS.', ...(result.developmentCode ? { development_code: result.developmentCode } : {}) });
    } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to start phone verification.' }); }
  });
  app.post('/api/auth/phone-verification/check', rateLimit(10, 15 * 60 * 1000, 'phone-otp-check'), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      if (!(await checkVerification(phone, req.body?.code))) throw failure(400, 'The verification code is incorrect or expired.');
      const claim = await issueVerificationToken(pool, phone);
      res.set('Cache-Control', 'no-store').json({ message: 'Phone number verified.', verification_token: claim.token, expires_at: claim.expiresAt.toISOString() });
    } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to verify this phone number.' }); }
  });

  app.post('/api/auth/password-reset/start', rateLimit(5, 60 * 60 * 1000, 'password-reset-start'), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      if (!/^\+91[6-9]\d{9}$/.test(phone)) throw failure(400, 'Enter a valid 10-digit Indian mobile number.');
      const now = Date.now();
      const attempt = resetSendLimits.get(phone);
      if (attempt && now < attempt.nextAt) throw failure(429, 'Wait one minute before requesting another code.');
      if (attempt && now < attempt.resetAt && attempt.count >= 5) throw failure(429, 'Too many codes were requested for this number. Try again later.');
      resetSendLimits.set(phone, !attempt || now >= attempt.resetAt
        ? { count: 1, resetAt: now + 60 * 60 * 1000, nextAt: now + 60 * 1000 }
        : { ...attempt, count: attempt.count + 1, nextAt: now + 60 * 1000 });
      if (resetSendLimits.size > 1000) for (const [key, value] of resetSendLimits) if (value.resetAt <= now) resetSendLimits.delete(key);
      const accountExists = (await pool.query('SELECT id FROM users WHERE phone=$1', [phone])).rows.length > 0;
      const result = accountExists ? await startVerification(phone) : {};
      return res.json({ message: 'If an account exists for this number, an SMS verification code has been sent.', ...(result.developmentCode ? { development_code: result.developmentCode } : {}) });
    } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to start password recovery.' }); }
  });

  app.post('/api/auth/password-reset/check', rateLimit(10, 15 * 60 * 1000, 'password-reset-check'), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      if (!isValidPhone(phone) || !(await pool.query('SELECT id FROM users WHERE phone=$1', [phone])).rows.length || !(await checkVerification(phone, req.body?.code))) {
        throw failure(400, 'The verification code is incorrect or expired.');
      }
      const claim = await issuePasswordResetToken(pool, phone);
      return res.set('Cache-Control', 'no-store').json({ message: 'Phone number verified.', reset_token: claim.token, expires_at: claim.expiresAt.toISOString() });
    } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to verify the recovery code.' }); }
  });

  app.post('/api/auth/password-reset/complete', rateLimit(5, 60 * 60 * 1000, 'password-reset-complete'), async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.phone);
      const password = String(req.body?.new_password || '');
      if (!isValidPhone(phone)) throw failure(400, 'Enter a valid account phone number.');
      if (!isStrongPassword(password)) throw failure(400, PASSWORD_REQUIREMENT);
      const hash = await bcrypt.hash(password, 12);
      await resetPasswordWithToken(pool, req.body?.reset_token, phone, hash);
      return res.set('Cache-Control', 'no-store').json({ message: 'Password reset successfully. Sign in with your new password.' });
    } catch (error) { return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to reset the password.' }); }
  });
}

module.exports = { normalizePhone, isValidPhone, providerConfig, startVerification, checkVerification, initPhoneVerification, issueVerificationToken, consumeVerificationToken, issuePasswordResetToken, resetPasswordWithToken, issuePasswordChangeToken, consumePasswordChangeToken, mountPhoneVerification };
