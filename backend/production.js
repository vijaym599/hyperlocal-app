function databaseConfig(env = process.env) {
  const config = env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {
    user: env.DB_USER, host: env.DB_HOST, database: env.DB_NAME,
    password: env.DB_PASSWORD, port: env.DB_PORT,
  };
  config.connectionTimeoutMillis = 10000;
  config.statement_timeout = 15000;
  if (env.DB_SSL === 'true') {
    // URL SSL parameters override pg's SSL object; avoid silently losing the CA.
    if (env.DATABASE_URL && ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) => new URL(env.DATABASE_URL).searchParams.has(key))) {
      throw new Error('Use DB_SSL settings or DATABASE_URL SSL parameters, not both.');
    }
    config.ssl = { rejectUnauthorized: true };
    if (env.DB_SSL_CA) config.ssl.ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
  }
  return config;
}

function validateProduction(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /replace|example|your.secret/i.test(env.JWT_SECRET)) {
    throw new Error('Production requires a random JWT_SECRET of at least 32 characters.');
  }
  const site = new URL(env.SITE_URL || 'http://invalid');
  if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password || /(^|\.)(example\.(com|org|net)|yourdomain\.in|localhost)$/.test(site.hostname)) {
    throw new Error('Production SITE_URL must be your real HTTPS origin.');
  }
  if (!env.DATABASE_URL && (!env.DB_HOST || !env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD || env.DB_PASSWORD === 'replace-me')) {
    throw new Error('Configure DATABASE_URL or all production DB credentials.');
  }
  if (!env.GEOCODER_USER_AGENT || /example\.com/.test(env.GEOCODER_USER_AGENT)) {
    throw new Error('Configure GEOCODER_USER_AGENT with a real support contact.');
  }
}

function trustProxy(value = '') {
  if (!value || value === 'false' || value === '0') return false;
  if (/^[1-9]\d*$/.test(value)) return Number(value);
  if (value === 'true') throw new Error('TRUST_PROXY must specify trusted proxy addresses or a hop count, not true.');
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

module.exports = { databaseConfig, validateProduction, trustProxy };
