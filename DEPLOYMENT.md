# Nearbuy launch preparation

## Prepared in the repository

- Same-origin production frontend/API/SEO deployment through Express.
- Multi-stage Dockerfile: locked dependency installation, built frontend, non-root runtime, database-backed health check.
- Hosted `DATABASE_URL`, optional verified PostgreSQL TLS and provider CA support; database connection/query timeouts.
- Production environment validation before schema initialization; secure response headers and configurable proxy trust.
- Graceful shutdown on SIGTERM/SIGINT, expired rate-limit entry cleanup, provider request spacing after completion.
- CI for lint, tests, frontend build and Docker image build.
- Read-only deployment smoke command.

## Production environment

Use backend/.env.example as the settings reference. Put real values in the host's secret/environment settings, never commit them.

Required: `NODE_ENV=production`, `SITE_URL=https://your-actual-domain`, a random `JWT_SECRET` of at least 32 characters, `GEOCODER_USER_AGENT` with your real support contact, and `DATABASE_URL` or all `DB_*` credentials. Generate a secret locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

For hosted PostgreSQL, use the provider's SSL instructions. `DB_SSL=true` verifies certificates; `DB_SSL_CA` accepts a PEM certificate including literal `\n` escapes. If supplying these settings, remove SSL parameters such as `sslmode` from `DATABASE_URL` to avoid overrides. Alternatively use the provider URL's SSL parameters alone. Certificate verification is never explicitly disabled by this app.

Set `CORS_ORIGIN` only when a separate frontend origin needs browser API access. Same-origin hosting needs no CORS allowlist. Leave `VITE_API_BASE_URL` unset for the supplied Docker build. Route the entire HTTPS domain to port 5000, including `/assets`, `/api`, `/shops`, `/shop`, `/product`, robots and sitemap endpoints.

`TRUST_PROXY=false` is the default. Configure the trusted proxy IPs/subnets where possible. A hop count such as `1` requires the backend to be accessible only through that proxy and every request path to use the same hop count. The proxy must overwrite forwarded headers. Use one app instance initially: geocoding queues and rate limits are in memory per process. Multi-instance hosting requires shared coordination before scaling.

References: [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies/), [node-postgres TLS configuration](https://node-postgres.com/features/ssl).

## Build and run

Without Docker, from the repository root:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run lint
npm test
npm run build
npm start
```

The host must retain `frontend/dist` beside `backend`. Run the backend from its directory, as `npm start` does, so local dotenv loading is consistent. Do not use the Vite development server in production.

With Docker available:

```powershell
docker build -t nearbuy .
docker run --init --restart unless-stopped --env-file backend/.env -p 127.0.0.1:5000:5000 nearbuy
```

For the hardened single-host runtime profile, use `docker compose -f compose.production.yml up -d --build`. It adds a read-only filesystem, dropped capabilities, no-new-privileges, bounded resources and log rotation. Keep port 5000 bound to loopback and publish the application only through the HTTPS reverse proxy.

Use a separately prepared production environment file for that command, or host-injected environment variables. The example assumes an HTTPS reverse proxy on the same host. A database on the host cannot be addressed as `localhost` from inside the container; use the actual reachable database hostname. Image builds exclude local secrets.

## Checks after hosting

```powershell
npm run smoke -- https://your-actual-domain
npm run security:smoke -- https://your-actual-domain
```

This reads the database health, homepage, built asset, robots, sitemap, directory and a missing product. It does not create accounts or modify data. Then manually check mobile GPS/area lookup, existing customer/owner login, product editing/images/CSV, reviews, contact links and admin permissions. Test a real shop/product URL with JavaScript disabled. See SEO_SETUP.md for Search Console setup.

## Backup and restore

Before first production startup, back up any existing database: startup includes schema and data backfills. Use the database host's scheduled encrypted backups with offsite retention. Verify a restore into a separate empty database before launch. With PostgreSQL client utilities and `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` and a secure password source configured:

```powershell
New-Item -ItemType Directory -Force backups
pg_dump --format=custom --file=backups/nearbuy-before-launch.dump
pg_restore --no-owner --no-acl --dbname=nearbuy_restore_check backups/nearbuy-before-launch.dump
```

Create `nearbuy_restore_check` separately first. These are instructions only; no backup schedule or restore has been executed. Never restore into the live database to test a backup. Backups and dump files are git-ignored.

## Remaining launch dependencies

- Domain/DNS, HTTPS host and production database credentials are required to publish.
- Payment integration needs a gateway decision and credentials plus server-side verification, webhook handling and subscription expiry. Current billing is a local demo. Production now returns HTTP 503 for **new shop registration and all subscription changes**; existing shop/catalog and customer flows remain available. Do not advertise paid onboarding until this is implemented. A free pilot needs an explicit free-plan flow first.
- Password recovery and phone verification require an agreed email/SMS provider and account verification design. They are not implemented by these deployment changes.
- Supply real support/legal business details, confirm initial catalog records and admin access, configure host logging/uptime alerts and scheduled backups, then perform the live browser checks above.

No hosting account, domain, payment gateway or external service was created or published by these changes.
