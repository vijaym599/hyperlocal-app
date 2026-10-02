const cleanSearch = (value) => String(value || '').trim().slice(0, 80);

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(10, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function mountAdminManagement(app, pool, authenticate) {
  const requireAdmin = async (req, res) => {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
    if (!result.rows[0]?.is_admin) {
      res.status(403).json({ error: 'Administrator access is required.' });
      return false;
    }
    return true;
  };

  app.get('/api/admin/users', authenticate, async (req, res) => {
    const q = cleanSearch(req.query.q);
    const role = ['all', 'customer', 'shop_owner'].includes(req.query.role) ? req.query.role : 'all';
    const verification = ['all', 'verified', 'unverified'].includes(req.query.verification) ? req.query.verification : 'all';
    const { page, limit, offset } = pagination(req.query);
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`
        SELECT u.id,u.owner_name,u.phone,u.email,u.user_type,u.is_admin,u.phone_verified,u.created_at,
          s.id AS shop_id,s.name AS shop_name,s.is_verified AS shop_verified,
          (SELECT COUNT(*)::int FROM user_activities a WHERE a.user_id=u.id) AS activity_count,
          COALESCE((SELECT SUM(e.reward_paise)::bigint FROM referral_earnings e WHERE e.user_id=u.id AND e.status='available'),0)::bigint AS available_reward_paise,
          COUNT(*) OVER()::int AS total_count
        FROM users u LEFT JOIN shops s ON s.user_id=u.id
        WHERE ($1='' OR u.owner_name ILIKE '%'||$1||'%' OR u.phone ILIKE '%'||$1||'%' OR COALESCE(u.email,'') ILIKE '%'||$1||'%' OR COALESCE(s.name,'') ILIKE '%'||$1||'%')
          AND ($2='all' OR u.user_type=$2)
          AND ($3='all' OR ($3='verified' AND u.phone_verified=TRUE) OR ($3='unverified' AND u.phone_verified=FALSE))
        ORDER BY u.created_at DESC,u.id DESC LIMIT $4 OFFSET $5`, [q, role, verification, limit, offset]);
      const total = result.rows[0]?.total_count || 0;
      return res.json({ users: result.rows.map(({ total_count, ...user }) => user), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('Admin users failed:', error.message);
      return res.status(500).json({ error: 'Unable to load users.' });
    }
  });

  app.get('/api/admin/shops', authenticate, async (req, res) => {
    const q = cleanSearch(req.query.q);
    const verification = ['all', 'verified', 'pending'].includes(req.query.verification) ? req.query.verification : 'all';
    const operation = ['all', 'open', 'closed'].includes(req.query.operation) ? req.query.operation : 'all';
    const { page, limit, offset } = pagination(req.query);
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`
        SELECT s.id,s.name,s.category,s.address,s.phone,s.whatsapp_number,s.google_map_link,s.is_open,
          s.is_verified,s.verified_at,s.subscription_plan,s.subscription_status,s.created_at,s.updated_at,
          u.id AS owner_id,u.owner_name,u.phone AS owner_phone,u.phone_verified AS owner_phone_verified,
          (SELECT COUNT(*)::int FROM products p WHERE p.shop_id=s.id) AS product_count,
          (SELECT COUNT(*)::int FROM shop_offers o WHERE o.shop_id=s.id AND o.is_active=TRUE) AS active_offer_count,
          (SELECT COUNT(*)::int FROM shop_reviews r WHERE r.shop_id=s.id) AS review_count,
          (SELECT COUNT(*)::int FROM user_activities a WHERE a.shop_id=s.id) AS activity_count,
          COUNT(*) OVER()::int AS total_count
        FROM shops s JOIN users u ON u.id=s.user_id
        WHERE ($1='' OR s.name ILIKE '%'||$1||'%' OR s.category ILIKE '%'||$1||'%' OR COALESCE(s.address,'') ILIKE '%'||$1||'%' OR u.owner_name ILIKE '%'||$1||'%' OR u.phone ILIKE '%'||$1||'%')
          AND ($2='all' OR ($2='verified' AND s.is_verified=TRUE) OR ($2='pending' AND s.is_verified=FALSE))
          AND ($3='all' OR ($3='open' AND s.is_open=TRUE) OR ($3='closed' AND s.is_open=FALSE))
        ORDER BY s.is_verified ASC,s.updated_at DESC,s.id DESC LIMIT $4 OFFSET $5`, [q, verification, operation, limit, offset]);
      const total = result.rows[0]?.total_count || 0;
      return res.json({ shops: result.rows.map(({ total_count, ...shop }) => shop), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('Admin shops failed:', error.message);
      return res.status(500).json({ error: 'Unable to load shops.' });
    }
  });

  app.patch('/api/admin/shops/:shopId/open-status', authenticate, async (req, res) => {
    const shopId = Number(req.params.shopId);
    if (!Number.isInteger(shopId) || shopId < 1 || typeof req.body?.is_open !== 'boolean') {
      return res.status(400).json({ error: 'A valid shop and open status are required.' });
    }
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`UPDATE shops SET is_open=$1,open_status_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE id=$2 RETURNING id,name,is_open,updated_at`, [req.body.is_open, shopId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Shop not found.' });
      return res.json({ message: 'Shop operating status updated.', shop: result.rows[0] });
    } catch (error) {
      console.error('Admin shop status failed:', error.message);
      return res.status(500).json({ error: 'Unable to update shop status.' });
    }
  });
}

module.exports = { mountAdminManagement };
