const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '');
const shopPath = (shop) => `/shop/${slug(`${shop.name} ${shop.address || ''}`) || 'shop'}-${shop.id}`;
const productPath = (product, shop) => `/product/${slug(`${product.name} ${shop.address || ''}`) || 'product'}-${product.id}`;
const safeUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
};
const rating = (row) => Number(row.review_count) > 0 && Number(row.average_rating) >= 1 && Number(row.average_rating) <= 5
  ? { '@type': 'AggregateRating', ratingValue: Number(row.average_rating), reviewCount: Number(row.review_count), bestRating: 5, worstRating: 1 } : undefined;
const ratingText = (row) => rating(row) ? `<p>Customer rating: ${escape(row.average_rating)}/5 (${escape(row.review_count)} reviews)</p>` : '';
function business(shop, origin) {
  const data = { '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': origin + shopPath(shop) + '#business', name: shop.name, url: origin + shopPath(shop), description: shop.category || undefined,
    address: shop.address ? { '@type': 'PostalAddress', streetAddress: shop.address, addressCountry: 'IN' } : undefined,
    telephone: shop.phone || undefined, hasMap: safeUrl(shop.google_map_link), aggregateRating: rating(shop) };
  if (shop.latitude != null && shop.longitude != null && Number.isFinite(Number(shop.latitude)) && Number.isFinite(Number(shop.longitude)) && Math.abs(Number(shop.latitude)) <= 90 && Math.abs(Number(shop.longitude)) <= 180) {
    data.geo = { '@type': 'GeoCoordinates', latitude: Number(shop.latitude), longitude: Number(shop.longitude) };
  }
  // These time fields drive the app's daily schedule; free-text hours alone do not establish days.
  if (/^\d{2}:\d{2}/.test(shop.opening_time || '') && /^\d{2}:\d{2}/.test(shop.closing_time || '')) data.openingHoursSpecification = {
    '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: shop.opening_time.slice(0, 5), closes: shop.closing_time.slice(0, 5)
  };
  return data;
}
function productSchema(product, shop, origin) {
  const data = { '@context': 'https://schema.org', '@type': 'Product', '@id': origin + productPath(product, shop) + '#product', name: product.name, description: product.description || undefined,
    image: safeUrl(product.image_url), brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined, aggregateRating: rating(product) };
  if (product.price != null && Number.isFinite(Number(product.price)) && Number(product.price) >= 0) data.offers = {
    '@type': 'Offer', url: origin + productPath(product, shop), price: Number(product.price), priceCurrency: 'INR',
    availability: `https://schema.org/${product.availability_status === 'out_of_stock' ? 'OutOfStock' : 'InStock'}`,
    seller: { '@type': 'LocalBusiness', '@id': origin + shopPath(shop) + '#business', name: shop.name }
  };
  return data;
}
const styles = 'body{font:16px/1.6 system-ui,sans-serif;color:#1e293b;background:#f8fafc;margin:0}header,main,footer{max-width:1050px;margin:auto;padding:24px}a{color:#047857}h1{line-height:1.2}article{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin:16px 0}img{max-width:100%;max-height:360px;object-fit:contain}nav{display:flex;gap:24px;flex-wrap:wrap}p{overflow-wrap:anywhere}';
function documentHtml({ title, description, canonical, content, schema, noindex = false }) {
  const json = JSON.stringify(schema || []).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}">${canonical ? `<link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">` : ''}<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website">${noindex ? '<meta name="robots" content="noindex">' : ''}<style>${styles}</style><script type="application/ld+json">${json}</script></head><body><header><nav><a href="/">Nearbuy</a><a href="/shops">Browse shops</a></nav></header><main>${content}</main><footer>Contact the shop to confirm current prices, stock and opening hours.</footer></body></html>`;
}
const shopDetails = (shop) => `<p>${escape(shop.category)}</p><p>${escape(shop.address)}</p>${shop.phone ? `<p><a href="tel:${escape(String(shop.phone).replace(/[^+\d]/g, ''))}">${escape(shop.phone)}</a></p>` : ''}${shop.opening_hours || shop.opening_time ? `<p>Opening hours: ${escape(shop.opening_hours || `${shop.opening_time} – ${shop.closing_time || ''}`)}</p>` : ''}${safeUrl(shop.google_map_link) ? `<p><a href="${escape(safeUrl(shop.google_map_link))}" rel="noopener">View map</a></p>` : ''}${ratingText(shop)}`;
const productCard = (product, shop) => `<article><h2><a href="${escape(productPath(product, shop))}">${escape(product.name)}</a></h2><p>₹${escape(product.price)} · ${escape(String(product.availability_status || 'available').replaceAll('_', ' '))}</p>${product.description ? `<p>${escape(product.description)}</p>` : ''}</article>`;
const ratedSelect = (table, alias, reviews, foreignKey) => `SELECT ${alias}.*, (SELECT ROUND(AVG(rating)::numeric,1) FROM ${reviews} WHERE ${foreignKey}=${alias}.id) AS average_rating, (SELECT COUNT(*)::int FROM ${reviews} WHERE ${foreignKey}=${alias}.id) AS review_count FROM ${table} ${alias}`;

function mountSeo(app, pool, { siteUrl = process.env.SITE_URL, dist = path.resolve(__dirname, '../frontend/dist') } = {}) {
  let origin;
  if (siteUrl) {
    const parsed = new URL(siteUrl);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('SITE_URL must be an HTTP(S) origin without a path or credentials.');
    origin = parsed.origin;
  }
  const ready = (req, res, next) => origin ? next() : res.status(503).set('X-Robots-Tag', 'noindex').send('Public SEO pages require SITE_URL configuration.');
  const failure = (res) => res.status(503).set('X-Robots-Tag', 'noindex').send('Temporarily unable to load the catalog. Please try again.');
  const missing = (res) => res.status(404).type('html').send(documentHtml({ title: 'Page not found | Nearbuy', description: 'This listing is unavailable.', content: '<h1>Page not found</h1><p><a href="/shops">Browse local shops</a></p>', noindex: true }));
  app.get('/robots.txt', (req, res) => res.type('text').send(origin ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n'));
  const batch = 1000;
  app.get('/sitemap.xml', ready, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT (SELECT COUNT(*) FROM shops)::int AS shops, (SELECT COUNT(*) FROM products p JOIN shops s ON s.id=p.shop_id)::int AS products');
      const locations = ['<sitemap><loc>' + escape(origin + '/sitemaps/pages.xml') + '</loc></sitemap>'];
      for (const kind of ['shops', 'products']) for (let page = 1; page <= Math.ceil(Number(rows[0][kind]) / batch); page++) locations.push(`<sitemap><loc>${escape(`${origin}/sitemaps/${kind}-${page}.xml`)}</loc></sitemap>`);
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.join('')}</sitemapindex>`);
    } catch { failure(res); }
  });
  app.get('/sitemaps/:file', ready, async (req, res) => {
    try {
      let urls;
      if (req.params.file === 'pages.xml') urls = ['/', '/shops'];
      else {
        const match = /^(shops|products)-([1-9]\d*)\.xml$/.exec(req.params.file);
        if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) > 2147483) return missing(res);
        const offset = (Number(match[2]) - 1) * batch;
        const result = match[1] === 'shops'
          ? await pool.query('SELECT id,name,address FROM shops ORDER BY id LIMIT $1 OFFSET $2', [batch, offset])
          : await pool.query('SELECT p.id,p.name,s.address FROM products p JOIN shops s ON s.id=p.shop_id ORDER BY p.id LIMIT $1 OFFSET $2', [batch, offset]);
        if (!result.rows.length) return missing(res);
        urls = result.rows.map((row) => match[1] === 'shops' ? shopPath(row) : productPath(row, row));
      }
      res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(origin + url)}</loc></url>`).join('')}</urlset>`);
    } catch { failure(res); }
  });
  app.get('/shops', ready, async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) return missing(res);
    try {
      const { rows } = await pool.query('SELECT id,name,address,category FROM shops ORDER BY id LIMIT $1 OFFSET $2', [51, (page - 1) * 50]);
      if (page > 1 && !rows.length) return missing(res);
      const content = `<h1>Local shops on Nearbuy</h1>${rows.slice(0, 50).map((shop) => `<article><h2><a href="${escape(shopPath(shop))}">${escape(shop.name)}</a></h2><p>${escape(shop.category)} · ${escape(shop.address)}</p></article>`).join('')}<nav>${page > 1 ? `<a href="/shops${page === 2 ? '' : `?page=${page - 1}`}">Previous</a>` : ''}${rows.length > 50 ? `<a href="/shops?page=${page + 1}">Next</a>` : ''}</nav>`;
      res.type('html').send(documentHtml({ title: `Local shops${page > 1 ? ` – Page ${page}` : ''} | Nearbuy`, description: 'Find local shops, their product catalogs, contact details and opening hours on Nearbuy.', canonical: origin + '/shops' + (page > 1 ? `?page=${page}` : ''), content }));
    } catch { failure(res); }
  });
  for (const kind of ['shop', 'product']) app.get(`/${kind}/:slug`, ready, async (req, res) => {
    const id = Number(/-(\d+)$/.exec(req.params.slug)?.[1]);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return missing(res);
    try {
      let shop, product;
      if (kind === 'shop') shop = (await pool.query(`${ratedSelect('shops', 's', 'shop_reviews', 'shop_id')} WHERE s.id=$1`, [id])).rows[0];
      else {
        product = (await pool.query(`${ratedSelect('products', 'p', 'product_reviews', 'product_id')} WHERE p.id=$1`, [id])).rows[0];
        if (product) shop = (await pool.query(`${ratedSelect('shops', 's', 'shop_reviews', 'shop_id')} WHERE s.id=$1`, [product.shop_id])).rows[0];
      }
      if (!shop) return missing(res);
      const canonicalPath = product ? productPath(product, shop) : shopPath(shop);
      if (req.path !== canonicalPath && decodeURI(req.path) !== canonicalPath) return res.redirect(301, origin + canonicalPath);
      let content, schema, title, description;
      if (product) {
        title = `${product.name} – ${shop.name}, ${shop.address || 'local shop'} | Nearbuy`;
        description = (product.description || `${product.name} at ${shop.name}, ${shop.address || 'your local shop'}. Check price, availability and contact the shop.`).slice(0, 240);
        const image = safeUrl(product.image_url) || (String(product.image_url).match(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/) ? product.image_url : undefined);
        content = `<h1>${escape(product.name)}</h1>${image ? `<img src="${escape(image)}" alt="${escape(product.name)}">` : ''}<p>${escape(product.brand)}</p><p>₹${escape(product.price)} · ${escape(String(product.availability_status || 'available').replaceAll('_', ' '))}</p><p>${escape(product.description)}</p>${ratingText(product)}<h2><a href="${escape(shopPath(shop))}">${escape(shop.name)}</a></h2>${shopDetails(shop)}`;
        schema = [business(shop, origin), productSchema(product, shop, origin)];
      } else {
        const { rows } = await pool.query('SELECT id,name,price,description,availability_status FROM products WHERE shop_id=$1 ORDER BY name,id', [id]);
        title = `${shop.name} – ${shop.category || 'Local shop'}, ${shop.address || 'India'} | Nearbuy`;
        description = `${shop.name}, ${shop.address || 'India'}. Browse ${shop.category || 'local'} products, prices, opening hours and contact details.`.slice(0, 240);
        content = `<h1>${escape(shop.name)}</h1>${shopDetails(shop)}<h2>Products</h2>${rows.map((row) => productCard(row, shop)).join('') || '<p>No products listed yet.</p>'}`;
        schema = [business(shop, origin)];
      }
      res.type('html').send(documentHtml({ title, description, canonical: origin + canonicalPath, content, schema }));
    } catch { failure(res); }
  });
  // The backend serves the Vite production build on the same public origin.
  app.get('/', (req, res, next) => {
    const index = path.join(dist, 'index.html');
    if (!fs.existsSync(index)) return next();
    let html = fs.readFileSync(index, 'utf8');
    if (origin) html = html.replace('</head>', `<link rel="canonical" href="${escape(origin + '/')}"></head>`);
    else res.set('X-Robots-Tag', 'noindex');
    html = html.replace('<div id="root"></div>', '<div id="root"><main><h1>Nearbuy – Find products and shops near you</h1><p>Explore local groceries, electronics and more. Compare listed prices and contact nearby shops.</p><a href="/shops">Browse local shop catalogs</a></main></div>');
    res.type('html').send(html);
  });
  app.use(express.static(dist, { index: false, redirect: false }));
}

module.exports = { mountSeo, shopPath, productPath, business, productSchema, documentHtml };
