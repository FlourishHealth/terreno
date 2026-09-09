---
category: Added
---

`TwilioVerifyProvider` at `@terreno/comms/adapters/twilioVerify` (optional peer `twilio`).
Starts and checks SMS/email OTP via a Verify service SID, classifies Twilio errors, redacts
destinations, never stores codes, and marks verification rows non-retryable. The example
backend registers the adapter when `TWILIO_VERIFY_SERVICE_SID` is set with account
credentials.
