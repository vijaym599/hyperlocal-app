const DAY_HOURS = 24;
const WEEK_HOURS = 7 * DAY_HOURS;
const MONTH_HOURS = 30 * DAY_HOURS;

const PERISHABLE_PRODUCT_PATTERN = /\b(?:milk|curd|yogurt|paneer|vegetable|fruit|greens?|egg|bread|bun|cake|meat|chicken|fish|juice)\b/i;
const DAILY_SHOP_PATTERN = /vegetable|fruit|bakery|restaurant|food|dining/i;
const MONTHLY_SHOP_PATTERN = /electronic|mobile|cloth|fashion|hardware|furniture|jewell|automotive|vehicle|stationery|book/i;

function freshnessHoursFor(product = {}) {
  const productText = `${product.name || ''} ${product.description || ''}`;
  const shopCategory = String(product.shop_category || product.category || '');
  if (PERISHABLE_PRODUCT_PATTERN.test(productText) || DAILY_SHOP_PATTERN.test(shopCategory)) return DAY_HOURS;
  if (MONTHLY_SHOP_PATTERN.test(shopCategory)) return MONTH_HOURS;
  return WEEK_HOURS;
}

function stockState(product = {}, now = new Date()) {
  if (product.availability_status === 'out_of_stock') return { effectiveStatus: 'out_of_stock', freshness: 'confirmed' };
  const updatedAt = new Date(product.availability_updated_at).getTime();
  const freshForMs = freshnessHoursFor(product) * 60 * 60 * 1000;
  const fresh = Number.isFinite(updatedAt) && now.getTime() - updatedAt < freshForMs;
  return { effectiveStatus: fresh ? (product.availability_status || 'available') : 'unconfirmed', freshness: fresh ? 'confirmed' : 'stale' };
}

// These expressions deliberately derive freshness at read time. A stale product
// is never destructively changed to out of stock; confirming it updates only the
// existing availability timestamp.
const STOCK_WINDOW_HOURS_SQL = `(CASE
  WHEN concat_ws(' ', p.name, p.description) ~* '(milk|curd|yogurt|paneer|vegetable|fruit|green|egg|bread|bun|cake|meat|chicken|fish|juice)' THEN 24
  WHEN s.category ~* '(vegetable|fruit|bakery|restaurant|food|dining)' THEN 24
  WHEN s.category ~* '(electronic|mobile|cloth|fashion|hardware|furniture|jewell|automotive|vehicle|stationery|book)' THEN 720
  ELSE 168
END)`;

const STOCK_IS_FRESH_SQL = `(p.availability_updated_at IS NOT NULL AND p.availability_updated_at > CURRENT_TIMESTAMP - (${STOCK_WINDOW_HOURS_SQL} * INTERVAL '1 hour'))`;
const STOCK_FRESHNESS_SQL = `(CASE WHEN p.availability_status = 'out_of_stock' OR ${STOCK_IS_FRESH_SQL} THEN 'confirmed' ELSE 'stale' END)`;
const EFFECTIVE_AVAILABILITY_SQL = `(CASE
  WHEN s.subscription_ends_at IS NULL OR s.subscription_ends_at <= CURRENT_TIMESTAMP THEN 'out_of_stock'
  WHEN p.availability_status = 'out_of_stock' THEN 'out_of_stock'
  WHEN NOT ${STOCK_IS_FRESH_SQL} THEN 'unconfirmed'
  ELSE p.availability_status
END)`;

module.exports = {
  DAY_HOURS,
  WEEK_HOURS,
  MONTH_HOURS,
  freshnessHoursFor,
  stockState,
  STOCK_WINDOW_HOURS_SQL,
  STOCK_IS_FRESH_SQL,
  STOCK_FRESHNESS_SQL,
  EFFECTIVE_AVAILABILITY_SQL,
};
