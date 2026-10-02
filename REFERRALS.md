# Customer shop referrals

## User flow

1. A customer opens **My activity**, copies their personal referral code or invitation link and shares it with a shop owner.
2. The link opens shop registration with the code filled in. The owner may also enter the code manually. Attribution must happen during signup and cannot be added later.
3. Registration saves exactly one referral earning for the shop inside the same database transaction as the new user/shop. Bad or ineligible codes roll back signup. Self-referrals, admin referrals and shop-owner referrals are rejected.
4. The reward is **20% of the first subscription price only**. Stored prices and earnings use integer paise: Basic ₹20 → ₹4; Pro ₹199 → ₹39.80; Advance ₹499 → ₹99.80; Enterprise ₹999 → ₹199.80. Browser-supplied amounts are ignored. Later plan switches/renewals do not earn another reward or change the recorded first plan.
5. Until a real payment is checked, the amount appears as **Payment review pending**, not spendable money. Admin checks payment outside the app, records its actual payment reference and verifies the referral. This credits the available wallet. A demo reference is rejected.
6. The user enters account holder name and UPI ID and requests the entire available balance. The server snapshots their account phone and payout details and attaches the exact referred shops to the request. There is only one pending/approved request per customer.
7. Admin sees customer name/ID, full account phone, phone format validity and actual phone verification flag, UPI details, shop IDs/names, original subscription plans and referral amounts. Customer role and admin permissions are checked against the database, not JWT role claims.
8. Admin approves or rejects with a reason. Approval reserves funds for payout; it does not make a transfer. Rejection releases the balance for a corrected request.
9. After completing a payout, admin records its actual transfer reference and confirms **Paid**. Users can see the transfer reference and payout history. Direct pending → paid, duplicate approvals, duplicate payment references and repeat redemption of paid funds are blocked.

## Gateway boundary

No payment gateway or payout provider is connected. Subscription verification and completed payout confirmations are manual admin attestations. The app does not independently verify a bank transfer or validate UPI account ownership. Phone format validity is displayed separately from the `phone_verified` flag; no OTP verification was added.

Production shop signup and subscription changes remain blocked by the previous demo-billing guard. The referral flow is usable in local development; production reward attribution must be attached to the future gateway's verified first-payment lifecycle. Do not unlock demo billing to enable production referrals.

When a gateway is selected, use verified, idempotent payment/webhook events to mark the first earning available. Approved redemptions can then initiate a provider payout, with paid confirmation driven by verified payout success. Handle failures/refunds as audited ledger adjustments; never treat admin approval or a browser payment reference as payment success.

## Data and checks

`backend/referrals.js` owns additive schema initialization, attribution, wallet calculation, transactional review/redemption and protected API routes. `db.initDb()` creates the referral schema on next startup. Financial records retain shop identity snapshots even if a shop is deleted; users with financial history cannot be cascade-deleted.

Balance = verified rewards − pending/approved redemptions − completed payouts. Customer-row locks serialize wallet changes across PostgreSQL connections. Rejected requests retain their audit records but do not debit the balance. Redemption items provide the admin's exact shop breakdown.

Normal checks from the repository root:

```powershell
npm test
npm run lint
npm run build
```

Run actual PostgreSQL registration/authorization/concurrency tests with configured database access:

```powershell
$env:RUN_REFERRAL_DB_TESTS='true'
node --test backend/tests/referrals.integration.test.js
```

These tests create a unique `nearbuy_referral_test_<random>` schema, use only its temporary records and drop only that schema afterward. They cover registration rollback, one-time rewards, 6 concurrent redemption requests, forged admin claims, isolation between users, approval versus paid status, rejected-balance restoration and duplicate payment references. CI supplies a separate PostgreSQL test service and runs these automatically.
