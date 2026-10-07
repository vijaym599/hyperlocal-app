const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { initSupportReports, mountSupportReports } = require('../supportReports');

test('support report schema preserves ownership, responses and an admin audit trail', async () => {
  let sql = '';
  await initSupportReports({ query: async (value) => { sql = value; return { rows: [] }; } });
  assert.match(sql, /CREATE TABLE IF NOT EXISTS support_reports/);
  assert.match(sql, /reporter_role IN \('customer','shop_owner'\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS support_report_events/);
  assert.match(sql, /support_reports_status_created_idx/);
});

test('customers and shop owners can report, owners see only their history, and admins respond with audit and notification', async () => {
  let report = null; const events = []; const notifications = [];
  const accounts = {
    1: { id: 1, owner_name: 'Customer One', phone: '+919000000001', email: 'one@example.com', user_type: 'customer', is_admin: false, shop_id: null, shop_name: null },
    2: { id: 2, owner_name: 'Shop Owner', phone: '+919000000002', email: null, user_type: 'shop_owner', is_admin: false, shop_id: 7, shop_name: 'Owner Shop' },
    9: { id: 9, owner_name: 'Admin', phone: '+919000000009', email: null, user_type: 'customer', is_admin: true, shop_id: null, shop_name: null },
  };
  const execute = async (sql, values = []) => {
    if (sql.startsWith('SELECT u.id,u.owner_name')) return { rows: accounts[values[0]] ? [accounts[values[0]]] : [] };
    if (sql === 'SELECT is_admin FROM users WHERE id=$1') return { rows: [{ is_admin: Boolean(accounts[values[0]]?.is_admin) }] };
    if (sql.startsWith('INSERT INTO support_reports')) {
      report = { id: 11, user_id: values[0], shop_id: values[1], reporter_role: values[2], category: values[3], subject: values[4], description: values[5], status: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      return { rows: [report] };
    }
    if (sql.includes('FROM support_reports r LEFT JOIN users a')) return { rows: report ? [{ ...report, total_count: 1 }] : [] };
    if (sql.includes('FROM support_reports r JOIN users u')) return { rows: report ? [{ ...report, ...accounts[report.user_id], total_count: 1 }] : [] };
    if (sql.startsWith('UPDATE support_reports SET response_seen_at')) return values[1] === report?.user_id ? { rows: [{ id: report.id, response_seen_at: new Date().toISOString() }] } : { rows: [] };
    throw new Error(`Unexpected query: ${sql.slice(0, 100)}`);
  };
  const client = { query: async (sql, values = []) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.startsWith('SELECT * FROM support_reports')) return { rows: report && report.id === values[0] ? [report] : [] };
    if (sql.startsWith('UPDATE support_reports SET status=')) { report = { ...report, status: values[0], admin_response: values[1], responded_by: values[2], responded_at: new Date().toISOString(), response_seen_at: null }; return { rows: [report] }; }
    if (sql.startsWith('INSERT INTO support_report_events')) { events.push(values); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO shop_notifications')) { notifications.push(values); return { rows: [] }; }
    return execute(sql, values);
  }, release() {} };
  const pool = { query: execute, connect: async () => client };
  const authenticate = (req, _res, next) => { req.user = { userId: Number(req.get('x-user-id')) }; next(); };
  const rateLimit = () => (_req, _res, next) => next();
  const app = express(); app.use(express.json()); mountSupportReports(app, pool, authenticate, rateLimit);
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, userId, options = {}) => fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId), ...options.headers } });
  try {
    const invalid = await request('/api/reports', 1, { method: 'POST', body: JSON.stringify({ category: 'bad', subject: 'Broken page', description: 'A sufficiently detailed problem description.' }) });
    assert.equal(invalid.status, 400);
    const created = await request('/api/reports', 2, { method: 'POST', body: JSON.stringify({ category: 'technical', subject: 'Catalog is not loading', description: 'The catalog remains blank after refreshing the shop dashboard.' }) });
    assert.equal(created.status, 201); assert.equal(report.shop_id, 7); assert.equal(report.reporter_role, 'shop_owner');
    assert.equal((await request('/api/reports/mine', 2)).status, 200);
    assert.equal((await request('/api/admin/reports', 1)).status, 403);
    const resolved = await request('/api/admin/reports/11', 9, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', admin_response: 'We repaired the catalog and verified that it now loads.' }) });
    assert.equal(resolved.status, 200); assert.equal(events.length, 1); assert.equal(notifications.length, 1);
    assert.equal((await request('/api/reports/11/read', 1, { method: 'PATCH' })).status, 404, 'another user cannot mark the response read');
    assert.equal((await request('/api/reports/11/read', 2, { method: 'PATCH' })).status, 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
