const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Pool } = require('../backend/node_modules/pg');
const bcrypt = require('../backend/node_modules/bcryptjs');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env'), quiet: true });
const { databaseConfig } = require('../backend/production');

const rawPhone = String(process.argv[2] || '').trim().replace(/[\s().-]/g, '');
const phone = /^\d{10}$/.test(rawPhone) ? `+91${rawPhone}` : rawPhone;
const name = String(process.argv[3] || 'Nearbuy Admin').trim().slice(0, 255);
if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
  console.error('Usage: npm run admin:bootstrap -- 7022647762 "Admin name"');
  process.exit(1);
}

const pool = new Pool(databaseConfig());
(async () => {
  const existing = await pool.query('SELECT id,is_admin FROM users WHERE phone=$1', [phone]);
  if (existing.rows.length) {
    if (existing.rows[0].is_admin) throw new Error(`An admin account already exists for ${phone}. Password was not changed.`);
    throw new Error(`A non-admin account already exists for ${phone}. Use admin:promote after verifying ownership.`);
  }
  const temporaryPassword = `${randomBytes(9).toString('base64url')}!7a`;
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const { rows } = await pool.query(`INSERT INTO users
    (owner_name,phone,password,user_type,is_admin,phone_verified,phone_verified_at)
    VALUES($1,$2,$3,'customer',TRUE,TRUE,CURRENT_TIMESTAMP)
    RETURNING id,owner_name,phone,is_admin,phone_verified`, [name, phone, passwordHash]);
  if (!await bcrypt.compare(temporaryPassword, passwordHash)) throw new Error('Generated password verification failed.');
  console.log(JSON.stringify({ ...rows[0], temporary_password: temporaryPassword }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
