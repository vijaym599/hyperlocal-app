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

// Kept as a no-op for callers that imported the old helper. Entitlements are
// projected by read queries so expiry never destroys owner-managed state.
const refreshSubscriptionEntitlements = async () => {};

module.exports = { refreshShopStatus, refreshSubscriptionEntitlements, SHOP_TIMEZONE };
