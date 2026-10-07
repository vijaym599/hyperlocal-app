# Security policy and OWASP review

## Reporting a vulnerability

Do not submit secrets, credentials, OTPs, customer data, or an exploitable vulnerability through a public issue. Send a private report to the production support/security contact configured for Nearbuy. Include the affected route, impact, reproduction steps, and whether customer data may be involved.

## OWASP Top 10:2025 review (7 October 2026)

This repository was reviewed against the OWASP Top 10:2025 as a risk-based source review. It is not a penetration-test certificate or a guarantee that no vulnerability exists.

| Risk | Current controls |
| --- | --- |
| A01 Broken Access Control | Database-backed session revocation, database role checks for admin operations, and owner-scoped shop/product/offer/report queries. |
| A02 Security Misconfiguration | Production environment validation, exact HTTPS CORS origins, CSP, HSTS, anti-framing, MIME sniffing protection, permissions policy, request IDs, generic 404/error responses, and no-cache authenticated responses. |
| A03 Software Supply Chain Failures | Lockfiles, `npm ci`, production dependency audits in CI, weekly Dependabot checks, and zero known production dependency vulnerabilities at review time. |
| A04 Cryptographic Failures | bcrypt cost 12, random production JWT secret requirement, HS256-only verification, 24-hour access tokens, one-time expiring OTP claims, and verified PostgreSQL TLS support. |
| A05 Injection | Parameterized SQL throughout active routes, allowlists for dynamic table/column choices, React output escaping, and escaped server-rendered SEO HTML/JSON-LD. |
| A06 Insecure Design | Verified payment actions are blocked in production until a gateway exists, subscription promotion redemption is single-use and concurrency-safe, bounded catalog responses, and explicit role separation. |
| A07 Authentication Failures | SMS OTP after password login, rate limits, generic credential errors, bounded strong passwords, password-reset purpose tokens, and all-session revocation. Phone changes require the current password plus a one-time SMS token, revoke every session, and have a 30-day cooldown. Legacy plaintext password acceptance was removed. |
| A08 Software or Data Integrity Failures | Server-side entitlement decisions, payment references are not trusted in production, promotion audit/redemption records, admin complaint audit events, and locked dependency installs. |
| A09 Logging and Alerting Failures | Structured security events for invalid/missing authentication and rate-limit violations, request correlation IDs, and sanitized server errors. Production hosting must alert on repeated events and 5xx rates. |
| A10 Mishandling Exceptional Conditions | Central malformed JSON, oversized body, 404 and unexpected-error handling; transaction rollback paths; provider timeouts; graceful shutdown; and bounded request/catalog sizes. |

## Required production operations

- Keep `backend/.env` and provider credentials outside Git and rotate any credential that is ever exposed.
- Send application logs to a protected service and alert on authentication failures, rate-limit events, provider failures, and elevated 5xx responses.
- Enable encrypted PostgreSQL backups and regularly test restoration in a separate database.
- Run CI, dependency audit, and an authenticated dynamic security scan before each public release.
- Configure only trusted reverse proxies and route the service exclusively through HTTPS.
- Rotate `JWT_SECRET` during the security release if all pre-release sessions must be invalidated immediately; otherwise previously issued tokens expire under their original term.
- Accounts that still contain a legacy plaintext password must use the verified **Forgot password** flow once; plaintext password login is no longer accepted.

## Residual risks before a full public launch

- Browser sessions currently use a bearer token stored by the frontend. The CSP limits script injection impact, but a future migration to short-lived access tokens with rotating HttpOnly refresh cookies would further reduce token theft risk.
- A verified payment gateway and signed webhook flow are still required. Production intentionally blocks demo billing paths.
- In-memory rate limiting is suitable for one application instance only. Use a shared limiter before horizontal scaling.
- A third-party penetration test and infrastructure review are still recommended before processing real payments or operating at scale.
