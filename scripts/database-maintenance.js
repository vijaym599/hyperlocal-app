const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('../backend/node_modules/pg');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env'), quiet: true });
const { databaseConfig } = require('../backend/production');

const command = process.argv[2] || 'inspect';
const appTables = new Set([
  'users', 'shops', 'products', 'product_requests', 'shop_offers', 'shop_reviews', 'product_reviews',
  'user_activities', 'referral_earnings', 'referral_redemptions', 'referral_redemption_items',
  'phone_verification_claims', 'page_visits', 'subscriptions',
]);
const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;
const pool = new Pool(databaseConfig());

async function tables(client) {
  const { rows } = await client.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  return rows.map((row) => row.table_name);
}

async function inspect(client) {
  const names = await tables(client);
  const identity = (await client.query('SELECT current_database() AS database, current_user AS user')).rows[0];
  console.log(`Database: ${identity.database} (user: ${identity.user})`);
  for (const name of names) {
    const count = (await client.query(`SELECT COUNT(*)::int AS count FROM ${quote(name)}`)).rows[0].count;
    console.log(`${appTables.has(name) ? 'app' : 'unknown'}\t${name}\t${count}`);
  }
  const indexes = await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes
    WHERE schemaname='public' ORDER BY tablename,indexname`);
  console.log('Indexes:');
  for (const index of indexes.rows) console.log(`${index.tablename}\t${index.indexname}\t${index.indexdef}`);
}

async function backupAndReset(client) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_DATABASE_RESET !== 'DELETE_NEARBUY_DATA') {
    throw new Error('Production reset requires ALLOW_PRODUCTION_DATABASE_RESET=DELETE_NEARBUY_DATA.');
  }
  const identity = (await client.query('SELECT current_database() AS database')).rows[0];
  if (process.env.DB_NAME && identity.database !== process.env.DB_NAME) throw new Error(`Connected database ${identity.database} does not match DB_NAME.`);
  const existing = await tables(client);
  const unknown = existing.filter((name) => !appTables.has(name));
  const targets = existing.filter((name) => appTables.has(name));
  if (!targets.includes('users') || !targets.includes('shops') || !targets.includes('products')) throw new Error('Expected Nearbuy core tables were not found; reset stopped.');
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('nearbuy-database-reset'))");
    const backup = { created_at: new Date().toISOString(), database: identity.database, tables: {}, ignored_unknown_tables: unknown };
    for (const name of targets) backup.tables[name] = (await client.query(`SELECT * FROM ${quote(name)}`)).rows;
    const backupDir = path.resolve(__dirname, '../backups');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const backupPath = path.join(backupDir, `nearbuy-before-reset-${stamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), { encoding: 'utf8', flag: 'wx' });
    await client.query(`TRUNCATE TABLE ${targets.map(quote).join(', ')} RESTART IDENTITY CASCADE`);
    await client.query('COMMIT');
    console.log(`Backup: ${backupPath}`);
    console.log(`Cleared ${targets.length} application tables. Unknown tables left untouched: ${unknown.join(', ') || 'none'}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

(async () => {
  const client = await pool.connect();
  try {
    if (command === 'inspect') await inspect(client);
    else if (command === 'backup-reset') await backupAndReset(client);
    else throw new Error('Use: node scripts/database-maintenance.js inspect|backup-reset');
  } finally { client.release(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
