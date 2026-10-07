const { subscriptionTerms } = require('./subscriptionTerms');

const PLAN_IDS = Object.freeze(['basic', 'pro', 'advance', 'enterprise']);

async function initSubscriptionPromotions(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_promotions (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    name VARCHAR(120) NOT NULL DEFAULT '2027 Annual Offer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    campaign_version INTEGER NOT NULL DEFAULT 1,
    purchase_months INTEGER NOT NULL DEFAULT 1 CHECK (purchase_months BETWEEN 1 AND 36),
    bonus_months INTEGER NOT NULL DEFAULT 11 CHECK (bonus_months BETWEEN 1 AND 36),
    eligible_plans TEXT[] NOT NULL DEFAULT ARRAY['basic','pro','advance','enterprise']::text[],
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMPTZ NOT NULL DEFAULT '2027-12-31 18:30:00+00',
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at > starts_at)
  );
  ALTER TABLE subscription_promotions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE subscription_promotions ADD COLUMN IF NOT EXISTS campaign_version INTEGER NOT NULL DEFAULT 0;

  INSERT INTO subscription_promotions (id,name,is_active,is_deleted,campaign_version,purchase_months,bonus_months,eligible_plans,starts_at,ends_at)
  VALUES (1,'2027 Annual Offer',TRUE,FALSE,1,1,11,ARRAY['basic','pro','advance','enterprise']::text[],CURRENT_TIMESTAMP,'2027-12-31 18:30:00+00')
  ON CONFLICT (id) DO NOTHING;

  -- Upgrade every pre-2027 installation exactly once. campaign_version keeps
  -- later administrator edits (including disabling the offer) intact.
  UPDATE subscription_promotions SET
    name='2027 Annual Offer',is_active=TRUE,is_deleted=FALSE,campaign_version=1,
    purchase_months=1,bonus_months=11,
    eligible_plans=ARRAY['basic','pro','advance','enterprise']::text[],
    starts_at=CURRENT_TIMESTAMP,ends_at='2027-12-31 18:30:00+00',updated_at=CURRENT_TIMESTAMP
  WHERE id=1 AND campaign_version < 1;

  ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS subscription_bonus_months INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscription_promotion_name VARCHAR(120);

  ALTER TABLE shop_subscription_queue
    ADD COLUMN IF NOT EXISTS purchase_months INTEGER,
    ADD COLUMN IF NOT EXISTS bonus_months INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promotion_id SMALLINT,
    ADD COLUMN IF NOT EXISTS promotion_campaign_version INTEGER,
    ADD COLUMN IF NOT EXISTS promotion_name VARCHAR(120);

  UPDATE shop_subscription_queue
  SET purchase_months = GREATEST(1, CEIL(term_days / 30.0)::int)
  WHERE purchase_months IS NULL;
  ALTER TABLE shop_subscription_queue ALTER COLUMN purchase_months SET NOT NULL;

  -- A campaign can be redeemed only once per shop. Keeping redemptions in a
  -- separate ledger makes the rule concurrency-safe and preserves history
  -- when the administrator edits, disables, or removes the live offer.
  CREATE TABLE IF NOT EXISTS subscription_promotion_redemptions (
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    promotion_id SMALLINT NOT NULL,
    campaign_version INTEGER NOT NULL CHECK (campaign_version > 0),
    purchase_id BIGINT NOT NULL UNIQUE REFERENCES shop_subscription_queue(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (shop_id,promotion_id,campaign_version)
  );
  UPDATE shop_subscription_queue
  SET promotion_id=1,promotion_campaign_version=1
  WHERE bonus_months > 0 AND promotion_name IS NOT NULL AND promotion_id IS NULL;
  UPDATE shop_subscription_queue
  SET promotion_campaign_version=1
  WHERE promotion_id IS NOT NULL AND bonus_months > 0 AND promotion_campaign_version IS NULL;
  INSERT INTO subscription_promotion_redemptions (shop_id,promotion_id,campaign_version,purchase_id,redeemed_at)
  SELECT DISTINCT ON (shop_id,promotion_id,promotion_campaign_version)
    shop_id,promotion_id,promotion_campaign_version,id,COALESCE(payment_confirmed_at,created_at)
  FROM shop_subscription_queue
  WHERE promotion_id IS NOT NULL AND promotion_campaign_version IS NOT NULL AND bonus_months > 0
  ORDER BY shop_id,promotion_id,promotion_campaign_version,payment_confirmed_at,id
  ON CONFLICT DO NOTHING;

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

  -- The legacy purchase import above can create additional promotional rows.
  UPDATE shop_subscription_queue
  SET promotion_id=1,promotion_campaign_version=1
  WHERE bonus_months > 0 AND promotion_name IS NOT NULL AND promotion_id IS NULL;
  INSERT INTO subscription_promotion_redemptions (shop_id,promotion_id,campaign_version,purchase_id,redeemed_at)
  SELECT DISTINCT ON (shop_id,promotion_id,COALESCE(promotion_campaign_version,1))
    shop_id,promotion_id,COALESCE(promotion_campaign_version,1),id,COALESCE(payment_confirmed_at,created_at)
  FROM shop_subscription_queue
  WHERE promotion_id IS NOT NULL AND bonus_months > 0
  ORDER BY shop_id,promotion_id,COALESCE(promotion_campaign_version,1),payment_confirmed_at,id
  ON CONFLICT DO NOTHING;
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
    campaign_version: Number(row.campaign_version || 1),
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
  const result = await pool.query(`SELECT id,name,is_active,campaign_version,purchase_months,bonus_months,eligible_plans,starts_at,ends_at,updated_at
    FROM subscription_promotions WHERE id=1 AND is_deleted=FALSE ${activeClause}`);
  return serializePromotion(result.rows[0]);
}

async function promotedSubscriptionTerms(pool, plan, { shopId = null } = {}) {
  const base = subscriptionTerms(plan);
  const result = await pool.query(`SELECT p.id,p.name,p.bonus_months,p.campaign_version FROM subscription_promotions p
    WHERE p.id=1 AND p.is_active=TRUE AND p.is_deleted=FALSE AND p.starts_at <= CURRENT_TIMESTAMP AND p.ends_at > CURRENT_TIMESTAMP
      AND $1 = ANY(p.eligible_plans) AND p.purchase_months=$2
      AND ($3::int IS NULL OR NOT EXISTS (SELECT 1 FROM subscription_promotion_redemptions r
        WHERE r.shop_id=$3 AND r.promotion_id=p.id AND r.campaign_version=p.campaign_version))`, [plan, base.months, shopId]);
  const promotion = result.rows[0];
  const bonusMonths = promotion ? Number(promotion.bonus_months) : 0;
  return {
    ...base,
    purchaseMonths: base.months,
    bonusMonths,
    totalMonths: base.months + bonusMonths,
    days: base.days + (bonusMonths * 30),
    promotionId: promotion ? Number(promotion.id) : null,
    promotionCampaignVersion: promotion ? Number(promotion.campaign_version || 1) : null,
    promotionName: promotion?.name || null,
  };
}

async function claimPromotionRedemption(pool, { shopId, purchaseId, terms }) {
  if (!terms.promotionId || !terms.bonusMonths) return false;
  const result = await pool.query(`INSERT INTO subscription_promotion_redemptions
    (shop_id,promotion_id,campaign_version,purchase_id) VALUES($1,$2,$3,$4)
    ON CONFLICT (shop_id,promotion_id,campaign_version) DO NOTHING RETURNING shop_id`,
  [shopId, terms.promotionId, terms.promotionCampaignVersion, purchaseId]);
  if (!result.rows.length) throw Object.assign(new Error('This shop has already used the current subscription offer.'), { status: 409 });
  return true;
}

async function getShopPromotion(pool, shopId) {
  const promotion = await getPromotion(pool, { activeOnly: true });
  if (!promotion) return { promotion: null, eligible: false, reason: 'no_active_offer' };
  const redeemed = await pool.query(`SELECT 1 FROM subscription_promotion_redemptions
    WHERE shop_id=$1 AND promotion_id=$2 AND campaign_version=$3 LIMIT 1`, [shopId, promotion.id, promotion.campaign_version]);
  return { promotion, eligible: !redeemed.rows.length, reason: redeemed.rows.length ? 'already_redeemed' : null };
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

module.exports = { PLAN_IDS, initSubscriptionPromotions, getPromotion, getShopPromotion, promotedSubscriptionTerms, claimPromotionRedemption, validatePromotion, serializePromotion };
