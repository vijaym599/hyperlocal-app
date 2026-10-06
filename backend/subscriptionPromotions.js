const { subscriptionTerms } = require('./subscriptionTerms');

const PLAN_IDS = Object.freeze(['basic', 'pro', 'advance', 'enterprise']);

async function initSubscriptionPromotions(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_promotions (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    name VARCHAR(120) NOT NULL DEFAULT 'Launch offer',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    purchase_months INTEGER NOT NULL DEFAULT 1 CHECK (purchase_months BETWEEN 1 AND 36),
    bonus_months INTEGER NOT NULL DEFAULT 6 CHECK (bonus_months BETWEEN 1 AND 36),
    eligible_plans TEXT[] NOT NULL DEFAULT ARRAY['pro','advance','enterprise']::text[],
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at > starts_at)
  );
  INSERT INTO subscription_promotions (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

  ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS subscription_bonus_months INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscription_promotion_name VARCHAR(120);

  ALTER TABLE shop_subscription_queue
    ADD COLUMN IF NOT EXISTS purchase_months INTEGER,
    ADD COLUMN IF NOT EXISTS bonus_months INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promotion_id SMALLINT,
    ADD COLUMN IF NOT EXISTS promotion_name VARCHAR(120);

  UPDATE shop_subscription_queue
  SET purchase_months = GREATEST(1, CEIL(term_days / 30.0)::int)
  WHERE purchase_months IS NULL;
  ALTER TABLE shop_subscription_queue ALTER COLUMN purchase_months SET NOT NULL;

  -- Registration purchases predate the queue-based renewal ledger. Add any
  -- missing current shop payment once so revenue reports include first sales.
  INSERT INTO shop_subscription_queue
    (shop_id,plan,payment_id,amount_paise,term_days,status,payment_confirmed_at,activated_at,starts_at,ends_at,purchase_months,bonus_months,promotion_name)
  SELECT s.id,s.subscription_plan,s.payment_id,s.subscription_amount_paise,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.subscription_ends_at-s.subscription_started_at))/86400)::int),
    'activated',COALESCE(s.subscription_started_at,s.created_at),COALESCE(s.subscription_started_at,s.created_at),
    COALESCE(s.subscription_started_at,s.created_at),s.subscription_ends_at,
    GREATEST(1,COALESCE(s.subscription_months,1)-COALESCE(s.subscription_bonus_months,0)),
    COALESCE(s.subscription_bonus_months,0),s.subscription_promotion_name
  FROM shops s
  WHERE s.payment_id IS NOT NULL AND s.subscription_amount_paise > 0
    AND s.subscription_started_at IS NOT NULL AND s.subscription_ends_at IS NOT NULL
  ON CONFLICT (payment_id) DO NOTHING;
  `);
}

function serializePromotion(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    is_active: Boolean(row.is_active),
    purchase_months: Number(row.purchase_months),
    bonus_months: Number(row.bonus_months),
    eligible_plans: Array.isArray(row.eligible_plans) ? row.eligible_plans : [],
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    updated_at: row.updated_at,
  };
}

async function getPromotion(pool, { activeOnly = false } = {}) {
  const activeClause = activeOnly
    ? 'AND is_active=TRUE AND starts_at <= CURRENT_TIMESTAMP AND ends_at > CURRENT_TIMESTAMP'
    : '';
  const result = await pool.query(`SELECT id,name,is_active,purchase_months,bonus_months,eligible_plans,starts_at,ends_at,updated_at
    FROM subscription_promotions WHERE id=1 ${activeClause}`);
  return serializePromotion(result.rows[0]);
}

async function promotedSubscriptionTerms(pool, plan) {
  const base = subscriptionTerms(plan);
  const result = await pool.query(`SELECT id,name,bonus_months FROM subscription_promotions
    WHERE id=1 AND is_active=TRUE AND starts_at <= CURRENT_TIMESTAMP AND ends_at > CURRENT_TIMESTAMP
      AND $1 = ANY(eligible_plans) AND purchase_months=$2`, [plan, base.months]);
  const promotion = result.rows[0];
  const bonusMonths = promotion ? Number(promotion.bonus_months) : 0;
  return {
    ...base,
    purchaseMonths: base.months,
    bonusMonths,
    totalMonths: base.months + bonusMonths,
    days: base.days + (bonusMonths * 30),
    promotionId: promotion ? Number(promotion.id) : null,
    promotionName: promotion?.name || null,
  };
}

function validatePromotion(body = {}) {
  const name = String(body.name || '').trim();
  const purchaseMonths = Number(body.purchase_months);
  const bonusMonths = Number(body.bonus_months);
  const eligiblePlans = Array.isArray(body.eligible_plans) ? [...new Set(body.eligible_plans.map(String))] : [];
  const startsAt = new Date(body.starts_at);
  const endsAt = new Date(body.ends_at);
  if (!name || name.length > 120) throw Object.assign(new Error('Offer name must contain 1 to 120 characters.'), { status: 400 });
  if (!Number.isInteger(purchaseMonths) || purchaseMonths < 1 || purchaseMonths > 36) throw Object.assign(new Error('Purchase months must be between 1 and 36.'), { status: 400 });
  if (!Number.isInteger(bonusMonths) || bonusMonths < 1 || bonusMonths > 36) throw Object.assign(new Error('Free months must be between 1 and 36.'), { status: 400 });
  if (!eligiblePlans.length || eligiblePlans.some((plan) => !PLAN_IDS.includes(plan))) throw Object.assign(new Error('Select at least one valid subscription plan.'), { status: 400 });
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw Object.assign(new Error('Offer end date must be after its start date.'), { status: 400 });
  return { name, purchaseMonths, bonusMonths, eligiblePlans, startsAt, endsAt, isActive: body.is_active === true };
}

module.exports = { PLAN_IDS, initSubscriptionPromotions, getPromotion, promotedSubscriptionTerms, validatePromotion, serializePromotion };
