# WhatsApp phone verification

Customer and shop-owner accounts now require successful phone verification before signup. Both signup screens send an OTP, check it, and submit a short-lived one-time server token with the registration request. The backend enforces the token even if the browser UI is bypassed.

The verified token is bound to the exact E.164 phone number, expires after 10 minutes and is consumed in the same database transaction that creates the account. Successful accounts set `phone_verified=true` and `phone_verified_at`. Invalid, expired, reused or different-phone tokens are rejected. OTP sends are limited by IP and phone number.

## Local development

Add these values to the uncommitted `backend/.env` and restart the backend:

```env
PHONE_OTP_PROVIDER=development
DEVELOPMENT_OTP_CODE=123456
```

The UI displays the development code after Send OTP. This provider is refused whenever `NODE_ENV=production`.

## Production WhatsApp setup

Create a Twilio Verify Service and connect an approved WhatsApp sender/brand. Configure secrets in the hosting provider, not in source control:

```env
PHONE_OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
```

Twilio requires phone numbers in E.164 form such as `+919876543210`. The app starts Verify with the `whatsapp` channel and accepts signup only when VerificationCheck returns `approved`. Twilio requires your own WhatsApp sender/brand for this channel. See [Twilio Verify WhatsApp](https://www.twilio.com/docs/verify/whatsapp) and [Verification Check](https://www.twilio.com/docs/verify/api/verification-check).

Until real credentials are supplied, production OTP endpoints return 503 and new accounts cannot be created. Existing verified or legacy accounts can still sign in. Credentials and real WhatsApp delivery were not tested in this repository.
