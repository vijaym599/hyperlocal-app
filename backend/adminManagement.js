const cleanSearch = (value) => String(value || '').trim().slice(0, 80);
const { getPromotion, validatePromotion, serializePromotion } = require('./subscriptionPromotions');

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
    const verification = ['all', 'verified', 'unverified'].includes(req.query.verification) ? req.query.verification : 'all';
    const { page, limit, offset } = pagination(req.query);
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`
        SELECT u.id,u.owner_name,u.phone,u.email,u.user_type,u.is_admin,u.phone_verified,u.created_at,
          (SELECT COUNT(*)::int FROM user_activities a WHERE a.user_id=u.id) AS activity_count,
          COALESCE((SELECT SUM(e.reward_paise)::bigint FROM referral_earnings e WHERE e.user_id=u.id AND e.status='available'),0)::bigint AS available_reward_paise,
          COUNT(*) OVER()::int AS total_count
        FROM users u
        WHERE u.user_type='customer' AND u.is_admin=FALSE
          AND ($1='' OR u.owner_name ILIKE '%'||$1||'%' OR u.phone ILIKE '%'||$1||'%' OR COALESCE(u.email,'') ILIKE '%'||$1||'%')
          AND ($2='all' OR ($2='verified' AND u.phone_verified=TRUE) OR ($2='unverified' AND u.phone_verified=FALSE))
        ORDER BY u.created_at DESC,u.id DESC LIMIT $3 OFFSET $4`, [q, verification, limit, offset]);
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
    const subscription = ['all', 'attention', 'expiring', 'expired', 'missing'].includes(req.query.subscription) ? req.query.subscription : 'all';
    const { page, limit, offset } = pagination(req.query);
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`
        SELECT s.id,s.name,s.category,s.address,s.phone,s.whatsapp_number,s.google_map_link,s.is_open,
          s.is_verified,s.verified_at,s.subscription_plan,s.subscription_status,s.subscription_started_at,
          s.subscription_ends_at,s.subscription_months,s.subscription_amount_paise,s.created_at,s.updated_at,
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
          AND ($4='all'
            OR ($4='attention' AND (s.subscription_ends_at IS NULL OR s.subscription_ends_at <= CURRENT_TIMESTAMP OR s.subscription_status='cancelled'))
            OR ($4='expiring' AND s.subscription_ends_at > CURRENT_TIMESTAMP AND s.subscription_ends_at <= CURRENT_TIMESTAMP + INTERVAL '30 days')
            OR ($4='expired' AND s.subscription_ends_at IS NOT NULL AND s.subscription_ends_at <= CURRENT_TIMESTAMP)
            OR ($4='missing' AND s.subscription_ends_at IS NULL))
        ORDER BY s.subscription_ends_at ASC NULLS FIRST,s.is_verified ASC,s.updated_at DESC,s.id DESC LIMIT $5 OFFSET $6`, [q, verification, operation, subscription, limit, offset]);
      const total = result.rows[0]?.total_count || 0;
      return res.json({ shops: result.rows.map(({ total_count, ...shop }) => shop), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('Admin shops failed:', error.message);
      return res.status(500).json({ error: 'Unable to load shops.' });
    }
  });

  app.get('/api/admin/subscriptions', authenticate, async (req, res) => {
    const status = ['all', 'attention', 'expiring', 'expired', 'missing'].includes(req.query.status) ? req.query.status : 'attention';
    try {
      if (!(await requireAdmin(req, res))) return;
      const result = await pool.query(`SELECT s.id,s.name,s.subscription_plan,s.subscription_status,s.subscription_started_at,s.subscription_ends_at,
        s.subscription_months,s.subscription_amount_paise,s.subscription_bonus_months,s.subscription_promotion_name,u.owner_name,u.phone AS owner_phone,
        CASE WHEN s.subscription_ends_at IS NULL THEN 'missing'
             WHEN s.subscription_ends_at <= CURRENT_TIMESTAMP THEN 'expired'
             WHEN s.subscription_ends_at <= CURRENT_TIMESTAMP + INTERVAL '30 days' THEN 'expiring'
             ELSE 'active' END AS term_status
        FROM shops s JOIN users u ON u.id=s.user_id
        WHERE ($1='all'
          OR ($1='attention' AND (s.subscription_ends_at IS NULL OR s.subscription_ends_at <= CURRENT_TIMESTAMP OR s.subscription_status='cancelled'))
          OR ($1='expiring' AND s.subscription_ends_at > CURRENT_TIMESTAMP AND s.subscription_ends_at <= CURRENT_TIMESTAMP + INTERVAL '30 days')
          OR ($1='expired' AND s.subscription_ends_at IS NOT NULL AND s.subscription_ends_at <= CURRENT_TIMESTAMP)
          OR ($1='missing' AND s.subscription_ends_at IS NULL))
        ORDER BY s.subscription_ends_at ASC NULLS FIRST,s.id DESC LIMIT 200`, [status]);
      return res.json({ subscriptions: result.rows, status });
    } catch (error) {
      console.error('Admin subscriptions failed:', error.message);
      return res.status(500).json({ error: 'Unable to load shop subscriptions.' });
    }
  });

  app.get('/api/admin/revenue', authenticate, async (req, res) => {
    const range = String(req.query.range || '30');
    if (!['7', '30', '90', '365', 'all'].includes(range)) return res.status(400).json({ error: 'Revenue range must be 7, 30, 90, 365, or all.' });
    try {
      if (!(await requireAdmin(req, res))) return;
      const days = range === 'all' ? null : Number(range);
      const timezone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata';
      const bucket = range === '365' || range === 'all'
        ? `date_trunc('month',payment_confirmed_at AT TIME ZONE $2)::date`
        : `(payment_confirmed_at AT TIME ZONE $2)::date`;
      const where = `status IN ('queued','activated') AND ($1::int IS NULL OR payment_confirmed_at >= CURRENT_TIMESTAMP - make_interval(days => $1::int))`;
      const [totals, plans, trend, recent] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS payment_count,COUNT(DISTINCT shop_id)::int AS paying_shops,
          COALESCE(SUM(amount_paise),0)::bigint AS gross_revenue_paise,
          COALESCE(ROUND(AVG(amount_paise)),0)::bigint AS average_payment_paise,
          COALESCE(SUM(bonus_months),0)::int AS bonus_months_granted
          FROM shop_subscription_queue WHERE ${where}`, [days]),
        pool.query(`SELECT plan,COUNT(*)::int AS payment_count,COUNT(DISTINCT shop_id)::int AS paying_shops,
          COALESCE(SUM(amount_paise),0)::bigint AS revenue_paise,COALESCE(SUM(bonus_months),0)::int AS bonus_months_granted
          FROM shop_subscription_queue WHERE ${where} GROUP BY plan ORDER BY revenue_paise DESC`, [days]),
        pool.query(`SELECT ${bucket} AS period,COUNT(*)::int AS payment_count,COALESCE(SUM(amount_paise),0)::bigint AS revenue_paise
          FROM shop_subscription_queue WHERE ${where} GROUP BY 1 ORDER BY 1`, [days, timezone]),
        pool.query(`SELECT q.id,q.shop_id,s.name AS shop_name,q.plan,q.amount_paise,q.purchase_months,q.bonus_months,
          q.promotion_name,q.status,q.payment_confirmed_at
          FROM shop_subscription_queue q JOIN shops s ON s.id=q.shop_id
          WHERE q.status IN ('queued','activated') AND ($1::int IS NULL OR q.payment_confirmed_at >= CURRENT_TIMESTAMP - make_interval(days => $1::int))
          ORDER BY q.payment_confirmed_at DESC,q.id DESC LIMIT 20`, [days]),
      ]);
      return res.json({ totals: totals.rows[0], plans: plans.rows, trend: trend.rows, recent_payments: recent.rows, range, timezone });
    } catch (error) {
      console.error('Admin revenue analytics failed:', error.message);
      return res.status(500).json({ error: 'Unable to load revenue analytics.' });
    }
  });

  app.get('/api/admin/subscription-promotion', authenticate, async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      return res.json({ promotion: await getPromotion(pool) });
    } catch (error) {
      console.error('Admin subscription promotion failed:', error.message);
      return res.status(500).json({ error: 'Unable to load the subscription offer.' });
    }
  });

  app.put('/api/admin/subscription-promotion', authenticate, async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const promotion = validatePromotion(req.body);
      const result = await pool.query(`INSERT INTO subscription_promotions
        (id,name,is_active,is_deleted,campaign_version,purchase_months,bonus_months,eligible_plans,starts_at,ends_at,updated_by,updated_at)
        VALUES (1,$1,$2,FALSE,1,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,is_active=EXCLUDED.is_active,
          is_deleted=FALSE,campaign_version=CASE WHEN subscription_promotions.is_deleted
            THEN subscription_promotions.campaign_version + 1 ELSE subscription_promotions.campaign_version END,
          purchase_months=EXCLUDED.purchase_months,bonus_months=EXCLUDED.bonus_months,
          eligible_plans=EXCLUDED.eligible_plans,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
          updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP
        RETURNING id,name,is_active,campaign_version,purchase_months,bonus_months,eligible_plans,starts_at,ends_at,updated_at`,
      [promotion.name, promotion.isActive, promotion.purchaseMonths, promotion.bonusMonths, promotion.eligiblePlans, promotion.startsAt, promotion.endsAt, req.user.userId]);
      return res.json({ message: promotion.isActive ? 'Subscription offer saved and enabled.' : 'Subscription offer saved but disabled.', promotion: serializePromotion(result.rows[0]) });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('Admin subscription promotion update failed:', error.message);
      return res.status(500).json({ error: 'Unable to save the subscription offer.' });
    }
  });

  app.delete('/api/admin/subscription-promotion', authenticate, async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      await pool.query('UPDATE subscription_promotions SET is_active=FALSE,is_deleted=TRUE,updated_by=$1,updated_at=CURRENT_TIMESTAMP WHERE id=1', [req.user.userId]);
      return res.json({ message: 'Subscription offer removed.', promotion: null });
    } catch (error) {
      console.error('Admin subscription promotion removal failed:', error.message);
      return res.status(500).json({ error: 'Unable to remove the subscription offer.' });
    }
  });

  app.post('/api/admin/shops/:shopId/subscription-reminder', authenticate, async (req, res) => {
    const shopId = Number(req.params.shopId);
    if (!Number.isInteger(shopId) || shopId < 1) return res.status(400).json({ error: 'A valid shop is required.' });
    try {
      if (!(await requireAdmin(req, res))) return;
      const shop = (await pool.query('SELECT id,name,subscription_plan,subscription_status,subscription_ends_at FROM shops WHERE id=$1', [shopId])).rows[0];
      if (!shop) return res.status(404).json({ error: 'Shop not found.' });
      const endDate = shop.subscription_ends_at ? new Date(shop.subscription_ends_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : null;
      const expired = shop.subscription_ends_at && new Date(shop.subscription_ends_at).getTime() <= Date.now();
      const message = !endDate
        ? `Your ${shop.subscription_plan} plan does not have an active renewal date. Please review and renew your subscription.`
        : expired
          ? `Your ${shop.subscription_plan} plan ended on ${endDate}. Renew to continue uninterrupted plan benefits.`
          : `Your ${shop.subscription_plan} plan ends on ${endDate}. Please renew before the due date to avoid interruption.`;
      const result = await pool.query(`INSERT INTO shop_notifications (shop_id,notification_type,title,message,created_by)
        SELECT $1,'renewal_reminder','Subscription renewal reminder',$2,$3
        WHERE NOT EXISTS (SELECT 1 FROM shop_notifications WHERE shop_id=$1 AND notification_type='renewal_reminder' AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours')
        RETURNING id,title,message,created_at`, [shopId, message, req.user.userId]);
      if (!result.rows.length) return res.status(409).json({ error: 'A renewal reminder was already sent to this shop in the last 24 hours.' });
      return res.status(201).json({ message: 'Renewal reminder sent to the shop owner.', notification: result.rows[0] });
    } catch (error) {
      console.error('Admin renewal reminder failed:', error.message);
      return res.status(500).json({ error: 'Unable to send renewal reminder.' });
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
