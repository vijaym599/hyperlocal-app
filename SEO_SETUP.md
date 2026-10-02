# Nearbuy SEO deployment

The Express backend now serves public, server-rendered `/shop/name-address-id` and `/product/name-address-id` pages from current PostgreSQL records. IDs prevent collisions; old names redirect permanently to the current canonical URL. `/shops` is a crawlable paginated directory. Pages include titles, descriptions, canonical links, Open Graph metadata, LocalBusiness and Product JSON-LD, and real review aggregates. Missing records return 404; database failures return 503 instead of indexing empty pages.

## Deploy

1. Set `SITE_URL=https://your-real-domain.in` in the backend environment (origin only). Without it, public listing pages return 503 and robots.txt disallows crawling. Do not publish with the example domain.
2. Run `npm ci` and `npm run build` in `frontend`. Deploy the resulting `frontend/dist` beside `backend`, then run `npm start` in `backend` with the existing database/auth environment.
3. Route the whole public domain over HTTPS to Express, including `/`, `/assets/*`, `/api/*`, `/shop/*`, `/product/*`, `/shops`, `/robots.txt`, `/sitemap.xml`, and `/sitemaps/*`. A static-host SPA fallback must not intercept these paths. The backend serves the Vite build and homepage canonical itself. Production API calls default to the same origin.
4. If the React frontend is separately hosted, set `VITE_API_BASE_URL` and `VITE_SITE_URL` before building. The public SEO domain must still route the listing, sitemap and robots endpoints to Express. The complete homepage canonical requires the backend-served build.
5. Open a shop/product URL with JavaScript disabled and confirm the name, price, address and links appear. Inspect View Source for canonical/JSON-LD. Confirm unknown IDs return 404 and renamed slugs return 301.

## Google setup after deployment

Verify ownership in Google Search Console using the actual domain's DNS TXT record (requires domain/DNS and Google account access). Submit `https://your-real-domain.in/sitemap.xml`. This is a sitemap index with batches of 1,000 listings, generated from the database, so catalog additions/deletions need no rebuild. Use URL Inspection for representative pages and Google's Rich Results Test for structured data.

Each owner should create/verify their Google Business Profile and keep address, phone, location, hours and photos accurate. Collect authentic customer reviews and meaningful product descriptions. No ranking or indexing timeline is guaranteed.

## Data limitations

Location text comes from each shop's existing address; the app does not have separate city/postcode fields, so the implementation does not invent them. Structured opening hours use the existing opening/closing time fields, which the app treats as a daily schedule; free-text hours remain visible without invented schema schedules. Weekly closing days require a future schedule data model. Ratings are included only when recorded reviews exist, with the same aggregate visible on the page. Missing data can prevent rich-result eligibility.

Product schema includes INR price, availability and seller. Inline uploaded images remain visible, but are excluded from schema image URLs: publish images at stable HTTPS URLs for full image discovery. The listing pages support browsing and contacting shops; the existing React app remains the interactive discovery/owner interface.

Guidance: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
