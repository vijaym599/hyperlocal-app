const Fuse = require('fuse.js');
const { STOCK_IS_FRESH_SQL, STOCK_FRESHNESS_SQL, EFFECTIVE_AVAILABILITY_SQL } = require('./stockFreshness');

const MAX_MESSAGE_LENGTH = 300;
const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 100;
const RESULT_LIMIT = 6;
const CANDIDATE_LIMIT = 120;
const FUZZY_THRESHOLD = 0.32;

const TERM_ALIASES = new Map(Object.entries({
  'அரிசி': 'rice', arisi: 'rice',
  'பால்': 'milk', paal: 'milk', pal: 'milk',
  'எண்ணெய்': 'oil', ennai: 'oil',
  'உப்பு': 'salt', uppu: 'salt',
  'சர்க்கரை': 'sugar', sakkarai: 'sugar',
  'பருப்பு': 'dal', paruppu: 'dal',
  'மாவு': 'atta', maavu: 'atta',
  'காபி': 'coffee', kaapi: 'coffee',
  'சோப்பு': 'soap', soapu: 'soap',
  biscuit: 'cookies', biscuits: 'cookies', snacks: 'cookies',
}));

const RELATED_TERMS = new Map(Object.entries({
  rice: ['basmati', 'ponni', 'sona masoori', 'grain'],
  milk: ['dairy', 'curd', 'yogurt', 'paneer'],
  oil: ['cooking oil', 'sunflower', 'groundnut', 'coconut oil', 'sesame oil'],
  salt: ['spices', 'masala', 'seasoning'],
  sugar: ['jaggery', 'sweetener'],
  dal: ['lentil', 'pulses', 'toor', 'moong', 'urad', 'chana'],
  atta: ['flour', 'wheat', 'maida'],
  coffee: ['tea', 'beverage', 'drinks'],
  soap: ['body wash', 'detergent', 'hygiene'],
  cookies: ['biscuit', 'cracker', 'snack'],
  toothbrush: ['toothpaste', 'oral care', 'dental', 'mouthwash'],
  toothpaste: ['toothbrush', 'oral care', 'dental', 'mouthwash'],
  shampoo: ['conditioner', 'hair oil', 'hair care'],
  bread: ['bun', 'bakery', 'rusk'],
  egg: ['eggs', 'poultry'],
  vegetables: ['vegetable', 'fresh produce', 'greens'],
  mobile: ['mobile phone', 'phone', 'smartphone', 'cellphone', 'handset', 'iphone', 'android phone', 'feature phone', 'mobile charger', 'phone case', 'power bank'],
  phone: ['mobile', 'mobile phone', 'smartphone', 'cellphone', 'handset', 'iphone', 'android phone', 'feature phone', 'mobile charger', 'phone case', 'power bank'],
  smartphone: ['mobile', 'mobile phone', 'phone', 'cellphone', 'handset', 'iphone', 'android phone'],
}));

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'find', 'for', 'from', 'give', 'i', 'in', 'is', 'it', 'me', 'my',
  'near', 'nearby', 'need', 'of', 'please', 'product', 'products', 'recommend', 'show', 'some', 'the',
  'to', 'want', 'with', 'within', 'under', 'below', 'upto', 'available', 'stock', 'best', 'good', 'cheap', 'cheapest',
  'enaku', 'ennaku', 'kattu', 'kaatu', 'kidaikuma', 'kidaikum', 'nearla', 'pakkathula', 'venum', 'kulla', 'keela',
  'எனக்கு', 'அருகில்', 'வேண்டும்', 'காட்டு', 'கிடைக்கும்', 'பொருள்', 'பொருட்கள்', 'நல்ல', 'கீழ்', 'க்குள்',
]);

const amount = String.raw`([0-9]+(?:[.,][0-9]{1,2})?)`;
const budgetPatterns = [
  new RegExp(String.raw`(?:under|below|within|less\s+than|max(?:imum)?|budget(?:\s+is)?|upto|up\s+to)\s*(?:₹|rs\.?|inr)?\s*${amount}`, 'iu'),
  new RegExp(String.raw`(?:₹|rs\.?|inr)\s*${amount}`, 'iu'),
  new RegExp(String.raw`${amount}\s*(?:rs\.?|rupees?)?\s*(?:kulla|kullae|ku\s+keela|keela|குள்|க்குள்|கீழ்)`, 'iu'),
];

const normalizeNumber = (value) => Number(String(value || '').replace(',', '.'));
const normalizedText = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase('en-IN');

function parseAssistantQuery(message) {
  const original = String(message || '').trim();
  const normalized = normalizedText(original);
  let budget = null;
  for (const pattern of budgetPatterns) {
    const match = normalized.match(pattern);
    const value = match ? normalizeNumber(match[1]) : NaN;
    if (Number.isFinite(value) && value >= 0 && value <= 99999999.99) {
      budget = value;
      break;
    }
  }

  const radiusMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:km|kilomet(?:er|re)s?|கிமீ)/iu);
  const explicitRadius = Boolean(radiusMatch);
  const parsedRadius = radiusMatch ? Number(radiusMatch[1]) : DEFAULT_RADIUS_KM;
  const radiusKm = Math.min(Math.max(Number.isFinite(parsedRadius) ? parsedRadius : DEFAULT_RADIUS_KM, 1), MAX_RADIUS_KM);

  const availableOnly = /(?:available|in\s*stock|stock\s*irukka|kidaik|கிடைக்க|இருப்பு)/iu.test(normalized);
  const removable = [
    ...budgetPatterns,
    /[0-9]+(?:\.[0-9]+)?\s*(?:km|kilomet(?:er|re)s?|கிமீ)/giu,
    /(?:₹|rs\.?|inr|rupees?|budget|price|விலை)/giu,
  ];
  let searchable = normalized;
  for (const pattern of removable) searchable = searchable.replace(pattern, ' ');
  const terms = searchable
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .map((term) => TERM_ALIASES.get(term.trim()) || term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term) && !/^\d+(?:\.\d+)?$/.test(term))
    .slice(0, 6);

  return { original, terms: [...new Set(terms)], budget, radiusKm, explicitRadius, availableOnly };
}

function relatedTermsFor(terms) {
  const related = new Set();
  for (const rawTerm of terms) {
    const term = normalizedText(rawTerm);
    for (const candidate of RELATED_TERMS.get(term) || []) related.add(candidate);
    for (const [root, candidates] of RELATED_TERMS) {
      if (!candidates.includes(term)) continue;
      related.add(root);
      for (const candidate of candidates) if (candidate !== term) related.add(candidate);
    }
  }
  return [...related];
}

function searchableProductFields(product) {
  return [product.name, product.brand, product.description].map(normalizedText);
}

function containsWholeTerm(field, term) {
  const searchable = ` ${normalizedText(field).replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()} `;
  const needle = ` ${normalizedText(term).replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()} `;
  return needle.length > 2 && searchable.includes(needle);
}

function exactScore(product, terms) {
  const fields = searchableProductFields(product);
  const weights = [8, 6, 2];
  if (!terms.every((term) => fields.some((field) => containsWholeTerm(field, term)))) return 0;
  return terms.reduce((score, term) => score + fields.reduce((total, field, index) => total + (containsWholeTerm(field, term) ? weights[index] : 0), 0), 0);
}

function stableProductOrder(left, right) {
  const stockPriority = { available: 0, low_stock: 1, unconfirmed: 2, out_of_stock: 3 };
  const stock = (stockPriority[left.availability_status] ?? 3) - (stockPriority[right.availability_status] ?? 3);
  if (stock) return stock;
  const open = Number(right.is_open === true) - Number(left.is_open === true);
  if (open) return open;
  const verified = Number(right.is_verified === true) - Number(left.is_verified === true);
  if (verified) return verified;
  return Number(left.distance_km) - Number(right.distance_km)
    || Number(right.product_average_rating) - Number(left.product_average_rating)
    || Number(left.price) - Number(right.price)
    || Number(left.id) - Number(right.id);
}

function fuzzyProducts(candidates, queryTerms, threshold = FUZZY_THRESHOLD) {
  const terms = [...new Set((Array.isArray(queryTerms) ? queryTerms : [queryTerms]).map(normalizedText).filter((term) => term.length > 1))];
  if (!terms.length) return [];
  const fuse = new Fuse(candidates, {
    includeScore: true,
    ignoreLocation: true,
    ignoreDiacritics: true,
    threshold,
    keys: [
      { name: 'name', weight: 0.58 },
      { name: 'brand', weight: 0.27 },
      { name: 'description', weight: 0.15 },
    ],
  });
  const ranked = new Map();
  for (const term of terms) {
    for (const { item, score = 1 } of fuse.search(term, { limit: RESULT_LIMIT * 4 })) {
      const current = ranked.get(item.id) || { item, scores: [] };
      current.scores.push(score);
      ranked.set(item.id, current);
    }
  }
  return [...ranked.values()]
    // Fuse applies the threshold per searched field. Its final weighted score can
    // be higher than that threshold, so coverage is the reliable acceptance gate.
    .filter(({ scores }) => scores.length === terms.length)
    .map(({ item, scores }) => {
      const coverage = scores.length / terms.length;
      const quality = scores.reduce((sum, score) => sum + (1 - score), 0) / scores.length;
      return { ...item, relevance_score: Number((coverage * 0.65 + quality * 0.35).toFixed(4)) };
    })
    .sort((left, right) => right.relevance_score - left.relevance_score || stableProductOrder(left, right))
    .slice(0, RESULT_LIMIT);
}

function semanticScore(product, terms) {
  let score = 0;
  let usedRelatedTerm = false;
  for (const term of terms) {
    const directScore = exactScore(product, [term]);
    if (directScore > 0) {
      score += directScore;
      continue;
    }
    const relatedScore = Math.max(0, ...relatedTermsFor([term]).map((relatedTerm) => exactScore(product, [relatedTerm])));
    if (relatedScore === 0) return 0;
    usedRelatedTerm = true;
    score += relatedScore * 0.75;
  }
  return usedRelatedTerm ? score : 0;
}

function selectAssistantResults(intent, candidates) {
  const ordered = [...candidates].sort(stableProductOrder);
  if (!intent.terms.length) return { products: ordered.slice(0, RESULT_LIMIT), matchType: 'nearby', relatedTerms: [] };

  const exact = ordered
    .map((product) => ({ product, score: exactScore(product, intent.terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || stableProductOrder(left.product, right.product))
    .slice(0, RESULT_LIMIT)
    .map(({ product, score }) => ({ ...product, relevance_score: score }));
  if (exact.length) return { products: exact, matchType: 'exact', relatedTerms: [] };

  const relatedTerms = relatedTermsFor(intent.terms);
  const related = ordered
    .map((product) => ({ product, score: semanticScore(product, intent.terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || stableProductOrder(left.product, right.product))
    .slice(0, RESULT_LIMIT)
    .map(({ product, score }) => ({ ...product, relevance_score: score }));
  if (related.length) return { products: related, matchType: 'related', relatedTerms };

  const similar = fuzzyProducts(ordered, intent.terms);
  if (similar.length) return { products: similar, matchType: 'similar', relatedTerms: [] };

  return { products: [], matchType: 'none', relatedTerms: [] };
}

function assistantAnswer(intent, products, matchType = 'exact') {
  const subject = intent.terms.length ? `“${intent.terms.join(' ')}”` : 'products';
  const budgetText = intent.budget == null ? '' : ` under ₹${intent.budget.toLocaleString('en-IN')}`;
  if (!products.length) return `I couldn't find an exact or related live match for ${subject}${budgetText} within ${intent.radiusKm} km. Try a wider distance, a higher budget, or a simpler product name.`;

  const closestDistance = Math.min(...products.map((product) => Number(product.distance_km)).filter(Number.isFinite));
  const expandedDistance = !intent.explicitRadius && Number.isFinite(closestDistance) && closestDistance > intent.radiusKm
    ? ` Nothing matched within ${intent.radiusKm} km, so I expanded the search. The nearest result is ${closestDistance.toFixed(1)} km away.`
    : '';
  if (matchType === 'similar') return `I couldn't find an exact match for ${subject}${budgetText}, but these are the closest name and catalog matches.${expandedDistance}`;
  if (matchType === 'related') return `I couldn't find an exact match for ${subject}${budgetText}, so I found related products from the live catalog.${expandedDistance}`;
  if (expandedDistance) return `I found live matches for ${subject}${budgetText}.${expandedDistance}`;
  const available = products.filter((product) => product.availability_status === 'available').length;
  return `I found ${products.length} nearby match${products.length === 1 ? '' : 'es'} for ${subject}${budgetText}. ${available} ${available === 1 ? 'is' : 'are'} currently marked available. Best text matches, active shops, and closer options are prioritised.`;
}

function mountCustomerAssistant(app, pool, limiter = (_req, _res, next) => next()) {
  app.post('/api/ai/customer-assistant', limiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const message = String(req.body?.message || '').trim();
    const latitude = Number(req.body?.lat);
    const longitude = Number(req.body?.lng);
    if (message.length < 2 || message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `Ask a question between 2 and ${MAX_MESSAGE_LENGTH} characters.` });
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return res.status(400).json({ error: 'A valid location is required for nearby recommendations.' });

    const intent = parseAssistantQuery(message);
    const searchRadiusKm = intent.explicitRadius ? intent.radiusKm : 1200;
    const values = [latitude, longitude, intent.budget, searchRadiusKm, intent.availableOnly, CANDIDATE_LIMIT];

    try {
      const candidateResult = await pool.query(
        `WITH assistant_candidates AS (
          SELECT p.id, p.name, p.description, p.brand, p.price,
                 ${EFFECTIVE_AVAILABILITY_SQL} AS availability_status,
                 ${STOCK_FRESHNESS_SQL} AS stock_freshness,
                 p.availability_updated_at,
                 s.id AS shop_id, s.name AS shop_name, s.category AS shop_category,
                 s.address, s.phone AS shop_phone, s.whatsapp_number AS shop_whatsapp_number,
                 s.image_url AS shop_image_url, s.is_open, s.is_verified,
                 COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM product_reviews WHERE product_id = p.id), 0) AS product_average_rating,
                 6371 * acos(LEAST(1, GREATEST(-1,
                   cos(radians($1)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians($2)) +
                   sin(radians($1)) * sin(radians(s.latitude))
                 ))) AS distance_km
          FROM products p
          JOIN shops s ON s.id = p.shop_id
          WHERE s.subscription_ends_at > CURRENT_TIMESTAMP
            AND p.availability_status <> 'out_of_stock'
            AND ($3::numeric IS NULL OR p.price <= $3)
            AND ($5::boolean = FALSE OR (p.availability_status = 'available' AND ${STOCK_IS_FRESH_SQL}))
        )
        SELECT * FROM assistant_candidates
        WHERE distance_km <= $4
        ORDER BY CASE availability_status WHEN 'available' THEN 0 WHEN 'low_stock' THEN 1 WHEN 'unconfirmed' THEN 2 ELSE 3 END,
                 CASE WHEN is_open THEN 0 ELSE 1 END, distance_km ASC,
                 product_average_rating DESC, price ASC, id ASC
        LIMIT $6`,
        values
      );
      const selection = selectAssistantResults(intent, candidateResult.rows || []);
      let products = selection.products;
      if (products.length) {
        const imageResult = await pool.query('SELECT id, image_url FROM products WHERE id = ANY($1::int[])', [products.map((product) => product.id)]);
        const images = new Map((imageResult.rows || []).map((product) => [Number(product.id), product.image_url]));
        products = products.map((product) => ({ ...product, image_url: images.get(Number(product.id)) || null }));
      }
      return res.json({
        answer: assistantAnswer(intent, products, selection.matchType),
        products,
        match_type: selection.matchType,
        related_terms: selection.relatedTerms,
        interpreted: { terms: intent.terms, budget: intent.budget, preferred_radius_km: intent.radiusKm, search_radius_km: searchRadiusKm, available_only: intent.availableOnly },
        read_only: true,
      });
    } catch (error) {
      console.error('Customer assistant error:', error.message);
      return res.status(500).json({ error: 'The assistant could not search the live catalog. Please try again.' });
    }
  });
}

module.exports = { mountCustomerAssistant, parseAssistantQuery, assistantAnswer, relatedTermsFor, selectAssistantResults };
