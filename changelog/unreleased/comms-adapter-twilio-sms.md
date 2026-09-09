---
category: Added
---

`TwilioSmsProvider` at `@terreno/comms/adapters/twilioSms` (optional peer `twilio`). Sends
prefer a messaging service SID over a from-number, require valid E.164 destinations, classify
Twilio error codes, and store a console deep link on accepted sends. The example backend
registers the adapter when Twilio env vars are complete.
