# SMS verification

Customer and shop-owner accounts use Twilio Verify SMS OTP for signup, authenticated password changes, and password recovery. Regular login uses the registered phone number and password without OTP. The backend enforces the OTP-protected actions even if the browser UI is bypassed.

Signup, password-change, and password-reset verification tokens are purpose-bound and cannot be substituted for one another. Each token is bound to the exact E.164 phone number, expires after 10 minutes and is single-use. Password changes and resets increment the account authentication version so existing sessions stop working. OTP attempts are rate limited.

## Local development

Add these values to the uncommitted `backend/.env` and restart the backend:

```env
PHONE_OTP_PROVIDER=development
DEVELOPMENT_OTP_CODE=123456
```

The UI displays the development code after Send OTP. This provider is refused whenever `NODE_ENV=production`.

## Production SMS setup

Create a Twilio Verify Service with SMS delivery enabled. Configure secrets in the hosting provider, not in source control:

```env
PHONE_OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
```

Twilio requires phone numbers in E.164 form such as `+919876543210`. The app starts Verify with the `sms` channel and accepts verification only when VerificationCheck returns `approved`. Confirm Twilio account eligibility, sender and regulatory requirements for the countries where the application will operate.

Until real credentials are supplied, production signup, password change, and password recovery return HTTP 503. Normal phone-and-password login remains available. Development OTP is intentionally unavailable in production. Credentials and real SMS delivery were not tested in this repository.
