const path = require('node:path');
const { Pool } = require('../backend/node_modules/pg');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env'), quiet: true });
const { databaseConfig } = require('../backend/production');

const phone = String(process.argv[2] || '').trim();
if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
  console.error('Usage: npm run admin:promote -- +919876543210');
  process.exit(1);
}
const pool = new Pool(databaseConfig());
pool.query(`UPDATE users SET is_admin=TRUE WHERE phone=$1 AND phone_verified=TRUE AND user_type='customer'
  RETURNING id,owner_name,phone`, [phone])
  .then(({ rows }) => {
    if (!rows.length) throw new Error('No verified customer account was found for this phone.');
    console.log(`Admin access enabled for user #${rows[0].id} (${rows[0].phone}).`);
  })
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
