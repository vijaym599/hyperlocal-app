# Database maintenance

The local `hyperlocal_db` was reset on 2026-10-02 after a JSON backup. Application rows were cleared with `TRUNCATE ... RESTART IDENTITY CASCADE`; tables and schema remained. The backup is under the git-ignored `backups/` directory and contains sensitive account data/password hashes, so keep it private.

Current schema initialization is idempotent and includes referral, OTP and core application tables. `backend/schemaOptimization.js` adds current-flow constraints and indexes for account phones/roles, one shop per owner, subscription state, coordinates, prices, request state, catalogs, reviews, activities, referral queues and unconsumed OTP claims.

`page_visits` stores an anonymous browser UUID, page name and timestamp for admin visit reporting. It does not store visitor phone numbers or IP addresses. Admin dashboard reports page views and distinct browser IDs using `Asia/Kolkata` calendar days by default.

Maintenance commands:

```powershell
npm run db:inspect
npm run db:verify
npm run db:reset
```

`db:reset` validates the connected database, backs up known Nearbuy application tables to `backups/`, then clears only those allowlisted tables. Unknown public tables are reported and left untouched. Production reset additionally requires the explicit `ALLOW_PRODUCTION_DATABASE_RESET=DELETE_NEARBUY_DATA` environment value.

After a verified customer signs up, grant the first operator admin access with:

```powershell
npm run admin:promote -- +919876543210
```

The command accepts only a verified customer account and uses a bound SQL parameter. There is no default admin after a full reset.

For a new empty local database only, an operator can bootstrap the first admin and receive a generated temporary password:

```powershell
npm run admin:bootstrap -- 7022647762 "Nearbuy Admin"
```

This trusted local maintenance command records the supplied phone as administratively verified and refuses to overwrite an existing account or password. Normal web registration still requires WhatsApp OTP.
