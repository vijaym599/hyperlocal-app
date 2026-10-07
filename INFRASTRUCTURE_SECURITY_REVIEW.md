# Infrastructure security review

Review date: 7 October 2026

## Scope reviewed

- Express/Node production runtime and health endpoint
- Multi-stage Docker build and runtime user
- Production environment validation and secret handling
- PostgreSQL connection/TLS configuration
- GitHub Actions, dependency installation, and update monitoring
- Reverse-proxy assumptions, process lifecycle, logs, backups, and scaling model

No public or staging deployment URL was present in the repository, so TLS configuration, DNS, firewall rules, cloud IAM, public ports, managed database ACLs, and live attack surface could not be externally verified.

## Controls implemented

- Runtime container runs as the unprivileged `node` user while application files remain root-owned.
- Production Compose binds the service to loopback for a local HTTPS reverse proxy, drops Linux capabilities, prevents privilege escalation, uses a read-only root filesystem, limits processes/CPU/memory, rotates container logs, and supplies writable temporary space only through a bounded tmpfs.
- Production startup rejects weak JWT secrets, non-HTTPS site/CORS origins, incomplete database configuration, placeholder geocoder contact details, and missing Twilio Verify credentials.
- Hosted PostgreSQL supports certificate verification and explicit CA configuration with connection/query timeouts.
- CI uses locked installs, tests, builds, production dependency audits, and Docker image builds; Dependabot checks npm and GitHub Actions weekly.
- Application health checks disclose only `ok` or `unavailable`; graceful shutdown and provider timeouts are configured.
- A read-only external HTTP security-smoke command checks security headers, HSTS, health disclosure, request IDs, query reflection, and hostile-origin CORS behavior.

## High-priority deployment requirements

1. Put an HTTPS reverse proxy or managed load balancer in front of `127.0.0.1:5000`; expose only ports 80/443 and redirect HTTP to HTTPS.
2. Configure `TRUST_PROXY` only for the actual proxy IP/subnet. Never set it to unrestricted `true`.
3. Restrict PostgreSQL network access to the application and administrative networks; use separate least-privilege migration and runtime database roles before multi-team production operation.
4. Store environment secrets in the hosting secret manager, not in image layers, source control, shell history, or support tickets. Rotate JWT/Twilio/database credentials at launch.
5. Enable encrypted automated backups, point-in-time recovery where available, retention policy, and restore testing into an isolated database.
6. Centralize logs and alert on security events, repeated 401/403/429 responses, 5xx rate, container restarts, database saturation, disk pressure, certificate expiry, and backup failures.
7. Use one application instance while rate limiting/geocoder coordination is in memory. Move these controls to a shared store before scaling horizontally.
8. Pin and routinely refresh the base image digest after the deployment platform is selected; scan the built image in that platform's registry.

## External validation command

After deploying an authorized staging environment:

```powershell
npm run security:smoke -- https://staging.your-domain.in
```

Follow that with an authenticated DAST/penetration test using dedicated customer, shop-owner, and admin test accounts. Never test a third-party or production target without written authorization and an agreed scope, time window, traffic limit, data-handling rule, and emergency contact.

## Remaining external evidence required

- Public/staging HTTPS URL and proof of authorization
- Hosting provider/network diagram, firewall/security-group rules, and load-balancer/reverse-proxy configuration
- Database provider TLS/ACL/backup/PITR configuration
- DNS registrar controls, MFA, certificate renewal, and domain-transfer lock
- Secret-manager, IAM, audit-log retention, monitoring, and incident-response configuration
- Payment provider webhook signature/replay/idempotency controls after payment integration exists
