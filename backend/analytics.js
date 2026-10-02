const PAGE_NAMES = new Set(['explore', 'offers', 'shop-portfolio', 'customer-auth', 'activity', 'my-shop', 'about', 'privacy', 'terms', 'report-issue', 'pricing']);

async function initAnalytics(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS page_visits (
    id BIGSERIAL PRIMARY KEY,
    visitor_id UUID NOT NULL,
    page_name VARCHAR(40) NOT NULL,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT page_visits_page_check CHECK(page_name IN ('explore','offers','shop-portfolio','customer-auth','activity','my-shop','about','privacy','terms','report-issue','pricing'))
  );
  CREATE INDEX IF NOT EXISTS page_visits_date_idx ON page_visits(visited_at DESC);
  CREATE INDEX IF NOT EXISTS page_visits_page_date_idx ON page_visits(page_name,visited_at DESC);
  CREATE INDEX IF NOT EXISTS page_visits_visitor_date_idx ON page_visits(visitor_id,visited_at DESC);`);
}

function mountAnalytics(app, pool, authenticate, rateLimit) {
  app.post('/api/analytics/visit', rateLimit(120, 60 * 60 * 1000, 'analytics-visit'), async (req, res) => {
    const visitorId = String(req.body?.visitor_id || '').trim().toLowerCase();
    const pageName = String(req.body?.page_name || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(visitorId) || !PAGE_NAMES.has(pageName)) {
      return res.status(400).json({ error: 'Invalid visit event.' });
    }
    try {
      await pool.query('INSERT INTO page_visits(visitor_id,page_name) VALUES($1,$2)', [visitorId, pageName]);
      return res.status(204).end();
    } catch (error) {
      console.error('Visit tracking failed:', error.message);
      return res.status(503).json({ error: 'Unable to record visit.' });
    }
  });

  app.get('/api/admin/overview', authenticate, async (req, res) => {
    const days = Number(req.query.days || 30);
    if (![7, 30, 90].includes(days)) return res.status(400).json({ error: 'Analytics range must be 7, 30, or 90 days.' });
    try {
      const admin = await pool.query('SELECT is_admin FROM users WHERE id=$1', [req.user.userId]);
      if (!admin.rows[0]?.is_admin) return res.status(403).json({ error: 'Administrator access is required.' });
      const timezone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata';
      const [totals, today, daily, pages, recentUsers, recentShops] = await Promise.all([
        pool.query(`SELECT
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE user_type='customer' AND is_admin=FALSE) AS customers,
          (SELECT COUNT(*)::int FROM users WHERE user_type='shop_owner') AS shop_owners,
          (SELECT COUNT(*)::int FROM users WHERE is_admin=TRUE) AS admins,
          (SELECT COUNT(*)::int FROM shops) AS total_shops,
          (SELECT COUNT(*)::int FROM shops WHERE is_verified=TRUE) AS verified_shops,
          (SELECT COUNT(*)::int FROM products) AS total_products,
          (SELECT COUNT(*)::int FROM product_requests WHERE status IN ('new','working')) AS open_requests`),
        pool.query(`SELECT COUNT(*)::int AS page_views,COUNT(DISTINCT visitor_id)::int AS unique_visitors
          FROM page_visits WHERE (visited_at AT TIME ZONE $1)::date=(CURRENT_TIMESTAMP AT TIME ZONE $1)::date`, [timezone]),
        pool.query(`WITH dates AS (SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE $1)::date-($2::int-1),
            (CURRENT_TIMESTAMP AT TIME ZONE $1)::date,'1 day'::interval)::date AS day),
          visits AS (SELECT (visited_at AT TIME ZONE $1)::date AS day,COUNT(*)::int AS page_views,COUNT(DISTINCT visitor_id)::int AS unique_visitors FROM page_visits WHERE visited_at >= CURRENT_TIMESTAMP-($2::int||' days')::interval GROUP BY 1),
          users_daily AS (SELECT (created_at AT TIME ZONE $1)::date AS day,COUNT(*)::int AS new_users FROM users WHERE created_at >= CURRENT_TIMESTAMP-($2::int||' days')::interval GROUP BY 1),
          shops_daily AS (SELECT (created_at AT TIME ZONE $1)::date AS day,COUNT(*)::int AS new_shops FROM shops WHERE created_at >= CURRENT_TIMESTAMP-($2::int||' days')::interval GROUP BY 1)
          SELECT d.day,COALESCE(v.page_views,0)::int AS page_views,COALESCE(v.unique_visitors,0)::int AS unique_visitors,
            COALESCE(u.new_users,0)::int AS new_users,COALESCE(s.new_shops,0)::int AS new_shops
          FROM dates d LEFT JOIN visits v USING(day) LEFT JOIN users_daily u USING(day) LEFT JOIN shops_daily s USING(day) ORDER BY d.day`, [timezone, days]),
        pool.query(`SELECT page_name,COUNT(*)::int AS page_views,COUNT(DISTINCT visitor_id)::int AS unique_visitors
          FROM page_visits WHERE visited_at >= CURRENT_TIMESTAMP-($1::int||' days')::interval
          GROUP BY page_name ORDER BY page_views DESC,page_name LIMIT 12`, [days]),
        pool.query(`SELECT id,owner_name,phone,user_type,is_admin,phone_verified,created_at FROM users ORDER BY created_at DESC,id DESC LIMIT 8`),
        pool.query(`SELECT id,name,category,subscription_plan,is_verified,created_at FROM shops ORDER BY created_at DESC,id DESC LIMIT 8`),
      ]);
      res.set('Cache-Control', 'no-store').json({
        totals: totals.rows[0], today: today.rows[0], daily: daily.rows, pages: pages.rows,
        recent_users: recentUsers.rows, recent_shops: recentShops.rows, range_days: days, timezone,
      });
    } catch (error) {
      console.error('Admin overview failed:', error.message);
      res.status(500).json({ error: 'Unable to load admin overview.' });
    }
  });
}

module.exports = { PAGE_NAMES, initAnalytics, mountAnalytics };
