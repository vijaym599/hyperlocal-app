# Nearbuy project guide

Reviewed on 2026-10-01. This guide records the current source implementation and is a starting point for future changes. Live database contents, browser behavior, deployment, and third-party service availability were not verified.

## Product and architecture

Nearbuy connects customers to products and shops near their location. Customers contact or visit shops to buy; there is no cart, checkout, order management, or delivery system in this repository.

- Frontend: React 19, Vite 8, Tailwind CSS 3, and Lucide icons; JavaScript/JSX.
- Backend: Express 5 on Node.js, PostgreSQL through `pg`, bcrypt passwords, and JWT authentication.
- Requests use browser `fetch`, with the base URL from `frontend/src/config.js`.
- Navigation is component state in `App.jsx`, without URL routing or deep links. Role defaults and restricted-tab fallbacks live in `frontend/src/session.mjs`.
- Authentication is persisted as a token, user, and shop snapshot under localStorage key `hyperlocal-session`. Favorites use `nearbuy-favorites` and are browser-local, not account-linked.
- `backend/index.js` contains the active API. `backend/server.js` simply requires it.
- Files under `backend/routes/` are not mounted by the active entry point. They contain older schemas and behavior; do not mistake them for the running API or mount them without reviewing authentication and schema compatibility.

## Roles and features

| Role | Current UI capabilities |
| --- | --- |
| Guest | GPS discovery, search, category/radius/stock filters, suggestions, product details, public reviews, portfolios, offers, favorites, sharing, contact/directions, product demand requests, registration/login |
| Customer | Guest discovery features plus posting/updating reviews and viewing personal activity |
| Shop owner | Shop registration wizard/login, profile/location/contact/hours editing, product CRUD and stock updates, CSV import, optimized image uploads, offer CRUD and activation, demo subscriptions, Pro-and-above engagement insights |
| Admin | Demand summaries/metrics, request status management, and shop verification |

Customer and shop-owner accounts share the users table and login endpoint. There is no UI/API for creating an admin: access comes from the database `users.is_admin` flag. Phone verification fields exist, but OTP verification and password recovery are not implemented. Forgot-password buttons display a future-feature notice.

## Source map

| File | Responsibility |
| --- | --- |
| `frontend/src/App.jsx` | Session, role derivation, page selection, common navigation/footer |
| `frontend/src/components/Navbar.jsx` | Desktop/mobile role-dependent navigation |
| `frontend/src/components/NearbySearch.jsx` | GPS, search, categories, suggestions, product/shop grids, 12-item pagination, details/reviews, contact activity, demand requests, favorites/sharing |
| `frontend/src/components/MyShop.jsx` | Owner authentication/registration, catalog, images/CSV, shop editor, offers, insights, billing |
| `frontend/src/components/CustomerAuth.jsx` | Shared login and customer signup; redirects to owner signup |
| `frontend/src/components/ShopPortfolio.jsx` | Full public shop catalog, independent of nearby search filters |
| `frontend/src/components/Offers.jsx` | Public active offers feed |
| `frontend/src/components/UserActivity.jsx` | Latest customer interactions |
| `frontend/src/components/DemandDashboard.jsx` | Admin request/shop operations and filtering |
| `frontend/src/components/PricingPage.jsx` | Plan comparison; plan data duplicated in MyShop |
| `frontend/src/components/AboutContent.jsx`, `LegalContent.jsx`, `ReportIssue.jsx`, `Footer.jsx` | Informational/legal/support views; issue reporting is a mailto link, not a stored ticket |
| `frontend/src/index.css` | Active Tailwind directives, global styles, discovery animations and reduced-motion support |
| `backend/index.js` | All active endpoints, validation, owner/admin checks, rate limits, geocoder/cache |
| `backend/db.js` | Pool configuration, automatic table creation, additive schema updates and data backfills |
| `backend/middleware/auth.js` | Bearer JWT verification |

## Main data flows

1. Explore immediately shows skeleton cards on a first visit. A valid first-page cache displays cards immediately with an updating label while the API refreshes price and stock. Snapshots expire after 30 minutes, are scoped to the API server, and omit inline image data. A cached manual area is reused; GPS is refreshed for cached GPS locations. Without GPS, the user can explicitly search an Indian area or pincode and choose a match.
2. `/api/search/products` returns 10 products by default, with `page`, `page_size`, `has_more`, and `next_page`. `limit` supports 1 to 48; page/category/coordinates are validated. Category filtering occurs before SQL pagination. Blank radius means 1200 km; text matches name/brand/description/shop name. Ordering is availability, distance, price, then product ID. The frontend shows one 10-product page with Previous/Next controls and derives shop cards from the current product page. Counts describe the current page. Query typing is debounced 250 ms; initial/filter loads start immediately. Cancellation, versions, and result keys prevent stale responses or mismatched locations/filters from displaying.
3. Suggestions require two characters and return up to eight available product/brand matches. `backend/geocoder.js` handles reverse lookup and explicit area search with shared request spacing, bounded 30-minute caches, timeouts, and configurable provider URLs. `/api/location/search` first tries Nominatim and falls back to Photon when the primary provider denies or returns no results; results are restricted to India. Lookup runs only on form submission. The UI includes OpenStreetMap attribution. Provider references: [Nominatim search API](https://nominatim.org/release-docs/latest/api/Search/) and [usage policy](https://operations.osmfoundation.org/policies/nominatim/).
4. Customer reviews are upserted per customer and target. Review writes and signed-in contact/catalog interactions create activity records. Owner insights aggregate these records; guest interactions are not included, and offers-page contact links do not record activity.
5. Owner registration creates the user and shop in a database transaction, then returns a seven-day JWT. Product/offer mutations check ownership against the database; admin routes check `is_admin` against the database.
6. Uploaded images are resized in browser canvas to at most 1200 pixels on the longest edge and exported as WebP up to approximately 1.2 MB. The data URL is stored in PostgreSQL `products.image_url`. There is no object-storage upload service. Missing images use external fallback URLs.
7. CSV is parsed in the browser with quoted-field, escaped-quote, multiline, and BOM support in `frontend/src/csv.mjs`, then posted as a JSON array. Invalid rows and blank prices are rejected; zero prices are accepted. The API accepts 1–200 rows and inserts them in one SQL statement after validation and a plan-limit check.
8. Open/closed status is maintained at server startup and every 15 seconds by `backend/shopSchedule.js`, using database time in `SHOP_TIMEZONE` (default `Asia/Kolkata`). Overnight schedules are supported; shops without both times keep their explicit status. The owner dashboard reads server status every minute. Status can lag a schedule boundary by one scheduler interval.

## Database

| Table | Key data and relationships |
| --- | --- |
| `users` | Owner/customer name, unique phone, optional unique email, password hash, role/admin and unused phone-verification fields |
| `shops` | User FK, name/category/address, required coordinates, map/contact/hours fields, open/verified status, subscription plan/status and payment reference |
| `products` | Shop FK, name/brand/description, numeric price, image URL/data URL, stock status and timestamps |
| `product_requests` | Requested text, optional phone/location/radius, status (`new`, `working`, `resolved` in API) |
| `shop_offers` | Shop FK, title/details/discount, optional expiry date, active status |
| `shop_reviews` | Shop/user FKs, rating 1–5, comment; unique shop/user pair |
| `product_reviews` | Product/user FKs, rating 1–5, comment; unique product/user pair |
| `user_activities` | User FK, optional shop/product FKs, action, JSONB details, creation time |

User deletion cascades to owned shops and reviews; shop deletion cascades to products/offers/reviews. Activities retain records with null shop/product references after those targets are deleted. There is no active separate subscriptions table and no active PostGIS requirement. Legacy route files refer to both.

`db.js` exports initialization, called and awaited by `startServer()` before the API listens. It also updates existing users' roles, auto-verifies qualifying paid shops, and replaces an activity constraint. These are startup mutations, not merely read-only schema checks. Initialization failure prevents listening, closes the pool, and sets a nonzero exit code. Importing `db.js` no longer initiates database queries.

## Active API map

All paths below are relative to `/api`.

| Area | Endpoints | Access |
| --- | --- | --- |
| Auth | POST `/auth/register-shop`, `/auth/register-customer`, `/auth/login`; old `/auth/register-custormer` alias | Public, auth rate limit |
| Discovery | GET `/search/products`, `/search/suggestions`, `/location/reverse`, `/location/search` | Public; geocoding routes rate limited |
| Catalog | GET `/shops/:shopId/products`, `/shops/:shopId/portfolio`, `/products/:id` | Public |
| Shop management | PUT `/shops/:shopId`; PATCH `/shops/:shopId/open-status`, `/shops/:shopId/subscription` | Authenticated owner |
| Product management | POST `/shops/:shopId/products`, `/shops/:shopId/products/bulk`; PUT/DELETE `/products/:id`; PATCH `/products/:id/availability` | Authenticated owner |
| Offers | GET `/offers` | Public; up to 100 active, unexpired offers, without geographic filtering |
| Offer management | GET/POST `/shops/:shopId/offers`; PATCH/DELETE `/offers/:offerId` | Authenticated owner |
| Reviews | GET/POST `/reviews/:target/:id`, target `shop` or `product` | Public reads; customer-only writes |
| Activity | POST `/activity/:action`; GET `/activity` | Customer only; latest 100 on reads |
| Insights | GET `/shops/:shopId/insights?period=monthly|total` | Owner; Pro/Advance/Enterprise |
| Demand | POST `/product-requests` | Public, rate limited |
| Admin | GET `/admin/product-requests`; PATCH `/admin/product-requests/:requestId`, `/admin/shops/:shopId/verification` | Admin |
| Compatibility feeds | GET `/explore`, `/shops/nearby-products` | Public; full nested catalog, no actual radius filtering |

Most queries use bound SQL parameters. Dynamic review table names are chosen from a fixed target whitelist. Rate limits and geocoding caches are process-local Maps; they are not shared across instances and do not have periodic eviction.

## Subscription rules

| Plan | Displayed monthly price | Product limit | Verified badge / insights |
| --- | --- | --- | --- |
| Basic | INR 20 | 10 | No |
| Pro | INR 199 | 100 | Yes |
| Advance | INR 499 | 300 | Yes |
| Enterprise | INR 999 | 999999, displayed as unlimited | Yes |

The frontend generates `MOCK_PAY_<timestamp>` references. The backend accepts any truthy payment reference without gateway verification. Cancellation only changes status and a timestamp; there are no billing periods, expiry checks, recurring charges, invoices, webhooks, or real payment processing. Entitlements continue to follow the plan field after cancellation. Verification can also be changed by an admin; startup backfills can restore a removed badge on qualifying shops.

## Local setup and verification

Run frontend/backend dev commands in their own directories. Run `npm test` at the root for both regression suites, or in each package for its own tests. API tests stub the database and do not load the local backend environment file.

1. Install each package with `npm ci` if dependencies are absent.
2. Create a PostgreSQL database and configure backend `.env` from `.env.example`: `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `JWT_SECRET`, optional `PORT`, `CORS_ORIGIN`, `GEOCODER_USER_AGENT`. No secret values are included in this guide.
3. Run `npm run dev` from `backend`; this runs `node index.js`, without automatic reload. Start from this directory because dotenv uses the current directory.
4. Configure `frontend/.env` with `VITE_API_BASE_URL=http://localhost:5000` for local development, then run `npm run dev` from `frontend`. The source default is already that URL. The example file contains a production placeholder.
5. For local CORS, omit `CORS_ORIGIN` in nonproduction or configure the exact frontend origin. Production defaults to disallowing cross-origin access unless origins are supplied.

Checks performed during review:

- Frontend `npm run build`: passed. First sandbox attempt hit child-process `EPERM`; rerun outside the sandbox passed.
- Frontend `npm run lint`: passed.
- `node --check backend/index.js` and `node --check backend/db.js`: passed.
- Regression tests cover role navigation, quoted/malformed CSV, nullable/invalid request radius, blank/zero bulk prices, and successful/failed startup gating.
- After discovery improvements: 17 regression tests passed, including paging, location lookup errors, cache expiry/corruption, page merging, and a local geocoder provider test. Frontend build/lint passed. Vite/React initial-render checks verified first-visit skeletons, immediate cached cards, saved-area labels, and load-more controls. In this sandbox, use `node --test --test-isolation=none frontend/tests/*.test.mjs backend/tests/*.test.js` because child-process workers are restricted.
- Backend was not launched during review because importing `db.js` changes the configured database. No API integration or browser end-to-end checks were performed.

## Findings to address in future work

These are source-confirmed behaviors or risks, not claims of live incidents.

The eight approved issues were addressed on 2026-10-01:

1. Restored-session defaults, login/logout redirects, and restricted-tab fallbacks prevent blank views.
2. Null, omitted, and empty optional radius values are accepted; nonpositive specified radii remain invalid.
3. Discovery preserves backend text matches and associated shops by removing redundant frontend text filtering.
4. Searches are cancelled and version-guarded. API failures show an error and retry control instead of a misleading empty result.
5. The server maintains opening schedules independently of the owner dashboard, with an explicit timezone.
6. CSV supports quoting and embedded newlines and rejects malformed rows and blank prices. The backend independently rejects blank bulk prices.
7. Startup waits for database initialization and initial schedule refresh; failure prevents listening.
8. The local backend environment file is preserved but removed from the Git index. Root ignore rules exclude environment files, dependencies, builds, logs, and uploads; example environment files remain trackable. Existing Git history is unchanged. Previously committed real secrets still need rotation through their providers; previously tracked dependency files remain tracked.

Remaining considerations outside these eight fixes:

- Demo billing is intentional for testing and remains unchanged.
- Product-limit checks and inserts are not serialized, so simultaneous additions can exceed a plan limit.
- Startup schema changes/backfills still mutate existing data; there is no versioned migration workflow.
- Product search uses bounded server pagination; legacy feeds remain unbounded, and inline images enlarge payloads. Offset pages can shift when catalog records change during browsing. Scaling work should follow real usage.
- Frontend sorting prioritizes distance rather than the server's stock/price ordering.
- Coordinates lack geographic range validation. Session expiry has no central recovery, stored shop snapshots can be stale, and some optional text updates cannot clear existing values.
- Legacy route files remain unmounted with incompatible schemas and older authentication. Do not activate them without review.
- Live PostgreSQL scheduling and browser end-to-end flows still need verification; API regression tests use a stubbed database.

## Working on this project

- Start with `App.jsx` for page/role changes, `NearbySearch.jsx` for discovery, `MyShop.jsx` for owner features, and `backend/index.js` for actual API behavior.
- Update frontend payloads, backend validation, and schema together when changing data contracts.
- Keep owner/customer/admin authorization enforced server-side. UI role checks are presentation only.
- Keep plan limits and benefits consistent across backend constants, MyShop, and PricingPage; shared definitions would reduce drift.
- For bug fixes, reproduce the relevant state/contract and validate the behavior, since a passing build/lint alone does not exercise it.
- Revisit this guide after structural or business-rule changes so future work starts from current facts.
