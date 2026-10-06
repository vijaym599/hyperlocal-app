const SHOP_TIMEZONE = process.env.SHOP_TIMEZONE || 'Asia/Kolkata';

// Database time is authoritative, including overnight opening hours.
const refreshShopStatus = (pool) => pool.query(`
  WITH scheduled AS (
    SELECT id, CASE WHEN opening_time <= closing_time
      THEN local_time >= opening_time AND local_time < closing_time
      ELSE local_time >= opening_time OR local_time < closing_time END AS scheduled_open
    FROM shops
    CROSS JOIN (SELECT (CURRENT_TIMESTAMP AT TIME ZONE $1)::time AS local_time) clock
    WHERE opening_time IS NOT NULL AND closing_time IS NOT NULL
  )
  UPDATE shops s SET is_open = scheduled.scheduled_open,
    open_status_updated_at = CURRENT_TIMESTAMP
  FROM scheduled WHERE s.id = scheduled.id AND s.is_open IS DISTINCT FROM scheduled.scheduled_open
`, [SHOP_TIMEZONE]);

// Expired subscriptions immediately lose catalog/offer publishing privileges.
// Product rows are retained for renewal, but customers see them as out of stock.
const refreshSubscriptionEntitlements = (pool) => pool.query(`
  UPDATE products p
  SET availability_status='out_of_stock',availability_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
  FROM shops s
  WHERE p.shop_id=s.id AND s.subscription_ends_at IS NOT NULL
    AND s.subscription_ends_at <= CURRENT_TIMESTAMP
    AND p.availability_status <> 'out_of_stock';

  UPDATE shop_offers o
  SET is_active=FALSE,updated_at=CURRENT_TIMESTAMP
  FROM shops s
  WHERE o.shop_id=s.id AND s.subscription_ends_at IS NOT NULL
    AND s.subscription_ends_at <= CURRENT_TIMESTAMP
    AND o.is_active=TRUE;
`);

module.exports = { refreshShopStatus, refreshSubscriptionEntitlements, SHOP_TIMEZONE };
