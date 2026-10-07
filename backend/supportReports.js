const REPORT_CATEGORIES = Object.freeze(['technical', 'account', 'shop_listing', 'product', 'billing', 'safety', 'other']);
const REPORT_STATUSES = Object.freeze(['open', 'in_progress', 'resolved', 'closed']);

const clean = (value, max) => String(value || '').trim().slice(0, max);
const positiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

async function initSupportReports(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS support_reports (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
    reporter_role VARCHAR(20) NOT NULL CHECK (reporter_role IN ('customer','shop_owner')),
    category VARCHAR(30) NOT NULL CHECK (category IN ('technical','account','shop_listing','product','billing','safety','other')),
    subject VARCHAR(140) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
    admin_response TEXT,
    responded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    responded_at TIMESTAMPTZ,
    response_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (char_length(subject) BETWEEN 5 AND 140),
    CHECK (char_length(description) BETWEEN 20 AND 3000),
    CHECK (admin_response IS NULL OR char_length(admin_response) BETWEEN 2 AND 3000)
  );
  CREATE INDEX IF NOT EXISTS support_reports_user_created_idx ON support_reports(user_id,created_at DESC);
  CREATE INDEX IF NOT EXISTS support_reports_status_created_idx ON support_reports(status,created_at DESC);

  CREATE TABLE IF NOT EXISTS support_report_events (
    id BIGSERIAL PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES support_reports(id) ON DELETE CASCADE,
    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS support_report_events_report_idx ON support_report_events(report_id,created_at DESC);
  `);
}

function mountSupportReports(app, pool, authenticate, rateLimit) {
  const accountFor = async (userId) => (await pool.query(`SELECT u.id,u.owner_name,u.phone,u.email,u.user_type,u.is_admin,s.id AS shop_id,s.name AS shop_name
    FROM users u LEFT JOIN shops s ON s.user_id=u.id WHERE u.id=$1 ORDER BY s.id LIMIT 1`, [userId])).rows[0];
  const requireReporter = async (req, res) => {
    const account = await accountFor(req.user.userId);
    if (!account) { res.status(404).json({ error: 'Account not found.' }); return null; }
    if (account.is_admin || !['customer', 'shop_owner'].includes(account.user_type)) { res.status(403).json({ error: 'Only customer and shop-owner accounts can submit complaints.' }); return null; }
    return account;
  };
  const requireAdmin = async (req, res) => {
    const result = await pool.query('SELECT is_admin FROM users WHERE id=$1', [req.user.userId]);
    if (!result.rows[0]?.is_admin) { res.status(403).json({ error: 'Administrator access is required.' }); return false; }
    return true;
  };

  app.post('/api/reports', authenticate, rateLimit(10, 60 * 60 * 1000, 'support-reports'), async (req, res) => {
    const category = clean(req.body?.category, 30);
    const subject = clean(req.body?.subject, 140);
    const description = clean(req.body?.description, 3000);
    if (!REPORT_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a valid problem category.' });
    if (subject.length < 5) return res.status(400).json({ error: 'Subject must contain at least 5 characters.' });
    if (description.length < 20) return res.status(400).json({ error: 'Please describe the problem using at least 20 characters.' });
    try {
      const account = await requireReporter(req, res); if (!account) return;
      if (account.user_type === 'shop_owner' && !account.shop_id) return res.status(409).json({ error: 'A shop-owner complaint requires an active shop account.' });
      const result = await pool.query(`INSERT INTO support_reports (user_id,shop_id,reporter_role,category,subject,description)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id,category,subject,description,status,created_at,updated_at`,
      [account.id, account.user_type === 'shop_owner' ? account.shop_id : null, account.user_type, category, subject, description]);
      return res.status(201).json({ message: 'Your complaint was sent. You can track the response from your dashboard.', report: result.rows[0] });
    } catch (error) {
      console.error('Support report creation failed:', error.message);
      return res.status(500).json({ error: 'Unable to send the complaint.' });
    }
  });

  app.get('/api/reports/mine', authenticate, async (req, res) => {
    const page = positiveInt(req.query.page); const limit = 20; const offset = (page - 1) * limit;
    try {
      const account = await requireReporter(req, res); if (!account) return;
      const result = await pool.query(`SELECT r.id,r.category,r.subject,r.description,r.status,r.admin_response,r.responded_at,r.response_seen_at,r.created_at,r.updated_at,
          a.owner_name AS responded_by_name,COUNT(*) OVER()::int AS total_count
        FROM support_reports r LEFT JOIN users a ON a.id=r.responded_by
        WHERE r.user_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT $2 OFFSET $3`, [account.id, limit, offset]);
      const total = result.rows[0]?.total_count || 0;
      return res.set('Cache-Control', 'no-store').json({ reports: result.rows.map(({ total_count, ...row }) => row), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('Own support reports failed:', error.message);
      return res.status(500).json({ error: 'Unable to load your complaints.' });
    }
  });

  app.patch('/api/reports/:reportId/read', authenticate, async (req, res) => {
    const reportId = positiveInt(req.params.reportId, 0);
    if (!reportId) return res.status(400).json({ error: 'A valid complaint is required.' });
    try {
      const account = await requireReporter(req, res); if (!account) return;
      const result = await pool.query(`UPDATE support_reports SET response_seen_at=COALESCE(response_seen_at,CURRENT_TIMESTAMP)
        WHERE id=$1 AND user_id=$2 AND admin_response IS NOT NULL RETURNING id,response_seen_at`, [reportId, account.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Complaint response not found.' });
      return res.json({ report: result.rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Unable to mark the response as read.' });
    }
  });

  app.get('/api/admin/reports', authenticate, async (req, res) => {
    const status = REPORT_STATUSES.includes(req.query.status) ? req.query.status : 'all';
    const role = ['customer', 'shop_owner'].includes(req.query.role) ? req.query.role : 'all';
    const query = clean(req.query.q, 80); const page = positiveInt(req.query.page); const limit = 20; const offset = (page - 1) * limit;
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`SELECT r.id,r.reporter_role,r.category,r.subject,r.description,r.status,r.admin_response,r.responded_at,r.response_seen_at,r.created_at,r.updated_at,
          u.id AS user_id,u.owner_name,u.phone,u.email,s.id AS shop_id,s.name AS shop_name,a.owner_name AS responded_by_name,
          COUNT(*) OVER()::int AS total_count
        FROM support_reports r JOIN users u ON u.id=r.user_id LEFT JOIN shops s ON s.id=r.shop_id LEFT JOIN users a ON a.id=r.responded_by
        WHERE ($1='all' OR r.status=$1) AND ($2='all' OR r.reporter_role=$2)
          AND ($3='' OR r.subject ILIKE '%'||$3||'%' OR r.description ILIKE '%'||$3||'%' OR u.owner_name ILIKE '%'||$3||'%' OR u.phone ILIKE '%'||$3||'%' OR COALESCE(u.email,'') ILIKE '%'||$3||'%' OR COALESCE(s.name,'') ILIKE '%'||$3||'%')
        ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,r.created_at ASC,r.id ASC
        LIMIT $4 OFFSET $5`, [status, role, query, limit, offset]);
      const total = result.rows[0]?.total_count || 0;
      return res.set('Cache-Control', 'no-store').json({ reports: result.rows.map(({ total_count, ...row }) => row), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('Admin support reports failed:', error.message);
      return res.status(500).json({ error: 'Unable to load complaints.' });
    }
  });

  app.patch('/api/admin/reports/:reportId', authenticate, async (req, res) => {
    const reportId = positiveInt(req.params.reportId, 0);
    const status = clean(req.body?.status, 20);
    const response = clean(req.body?.admin_response, 3000);
    if (!reportId) return res.status(400).json({ error: 'A valid complaint is required.' });
    if (!REPORT_STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a valid complaint status.' });
    if (['resolved', 'closed'].includes(status) && response.length < 2) return res.status(400).json({ error: 'Add a response before resolving or closing the complaint.' });
    if (response && response.length < 2) return res.status(400).json({ error: 'Response must contain at least 2 characters.' });
    let client;
    try {
      if (!(await requireAdmin(req, res))) return;
      client = await pool.connect(); await client.query('BEGIN');
      const existing = (await client.query('SELECT * FROM support_reports WHERE id=$1 FOR UPDATE', [reportId])).rows[0];
      if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Complaint not found.' }); }
      const changedForReporter = existing.status !== status || String(existing.admin_response || '') !== response;
      const updated = (await client.query(`UPDATE support_reports SET status=$1,admin_response=$2,
          responded_by=CASE WHEN $2::text<>'' THEN $3 ELSE responded_by END,
          responded_at=CASE WHEN $2::text<>'' THEN CURRENT_TIMESTAMP ELSE responded_at END,
          response_seen_at=CASE WHEN $2::text<>COALESCE(admin_response,'') THEN NULL ELSE response_seen_at END,
          updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *`, [status, response || null, req.user.userId, reportId])).rows[0];
      await client.query(`INSERT INTO support_report_events (report_id,actor_user_id,previous_status,new_status,response)
        VALUES($1,$2,$3,$4,$5)`, [reportId, req.user.userId, existing.status, status, response || null]);
      if (changedForReporter && existing.shop_id) {
        const message = response ? `Status: ${status.replace('_', ' ')}\n\nAdmin response: ${response}` : `Your complaint “${existing.subject}” is now ${status.replace('_', ' ')}.`;
        await client.query(`INSERT INTO shop_notifications (shop_id,notification_type,title,message,created_by)
          VALUES($1,'support_response',$2,$3,$4)`, [existing.shop_id, `Complaint update: ${existing.subject}`.slice(0, 120), message, req.user.userId]);
      }
      await client.query('COMMIT');
      return res.json({ message: 'Complaint updated and the sender can now see the response.', report: updated });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      console.error('Admin support report update failed:', error.message);
      return res.status(500).json({ error: 'Unable to update the complaint.' });
    } finally { client?.release(); }
  });
}

module.exports = { REPORT_CATEGORIES, REPORT_STATUSES, initSupportReports, mountSupportReports };
