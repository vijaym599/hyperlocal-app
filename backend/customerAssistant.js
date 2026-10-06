const MAX_MESSAGE_LENGTH = 300;
const DEFAULT_RADIUS_KM = 25;
const MAX_RADIUS_KM = 100;
const RESULT_LIMIT = 6;

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

function parseAssistantQuery(message) {
  const original = String(message || '').trim();
  const normalized = original.toLocaleLowerCase('en-IN');
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

function assistantAnswer(intent, products) {
  const subject = intent.terms.length ? `“${intent.terms.join(' ')}”` : 'products';
  const budgetText = intent.budget == null ? '' : ` under ₹${intent.budget.toLocaleString('en-IN')}`;
  if (!products.length) return `I couldn't find live ${subject}${budgetText} within ${intent.radiusKm} km. Try a wider distance, a higher budget, or a simpler product name.`;
  const closestDistance = Math.min(...products.map((product) => Number(product.distance_km)).filter(Number.isFinite));
  if (!intent.explicitRadius && Number.isFinite(closestDistance) && closestDistance > intent.radiusKm) {
    return `I couldn't find ${subject}${budgetText} within ${intent.radiusKm} km, so I found the closest live matches instead. The nearest is ${closestDistance.toFixed(1)} km away.`;
  }
  const available = products.filter((product) => product.availability_status === 'available').length;
  return `I found ${products.length} nearby match${products.length === 1 ? '' : 'es'} for ${subject}${budgetText}. ${available} ${available === 1 ? 'is' : 'are'} currently marked available. Active shops and closer options are prioritised.`;
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
    const searchText = `concat_ws(' ', p.name, p.brand, p.description, s.name, s.category)`;
    const termClauses = intent.terms.map((_, index) => `${searchText} ILIKE $${5 + index}`).join(' OR ');
    const limitParameter = 5 + intent.terms.length;
    const values = [latitude, longitude, intent.budget, searchRadiusKm, ...intent.terms.map((term) => `%${term}%`), RESULT_LIMIT];

    try {
      const result = await pool.query(
        `WITH assistant_candidates AS (
          SELECT p.id, p.name, p.description, p.brand, p.price, p.image_url, p.availability_status,
                 s.id AS shop_id, s.name AS shop_name, s.category AS shop_category,
                 s.address, s.image_url AS shop_image_url, s.is_open, s.is_verified,
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
            ${termClauses ? `AND (${termClauses})` : ''}
        )
        SELECT * FROM assistant_candidates
        WHERE distance_km <= $4
        ORDER BY CASE availability_status WHEN 'available' THEN 0 ELSE 1 END,
                 distance_km ASC, product_average_rating DESC, price ASC, id ASC
        LIMIT $${limitParameter}`,
        values
      );
      const products = result.rows || [];
      return res.json({
        answer: assistantAnswer(intent, products),
        products,
        interpreted: { terms: intent.terms, budget: intent.budget, preferred_radius_km: intent.radiusKm, search_radius_km: searchRadiusKm, available_only: intent.availableOnly },
        read_only: true,
      });
    } catch (error) {
      console.error('Customer assistant error:', error.message);
      return res.status(500).json({ error: 'The assistant could not search the live catalog. Please try again.' });
    }
  });
}

module.exports = { mountCustomerAssistant, parseAssistantQuery, assistantAnswer };
