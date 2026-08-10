# Tasks: Comms adapter — Twilio SMS

IP: [comms-adapter-twilio-sms](../implementationPlans/comms-adapter-twilio-sms.md)

## Phase 1 — Send path

- [ ] **Task 1.1**: `TwilioSmsProvider` with config resolution
  - Description: constructor/env config, messaging-service-first sender selection
  - Files: `comms/src/adapters/twilioSms.ts`
  - Depends on: comms-abstraction Phase 1
  - Acceptance: mocked-client tests cover both sender configs
- [ ] **Task 1.2**: E.164 validation + error mapping
  - Description: `libphonenumber-js` normalization; Twilio error codes into `SendResult.error` + metadata
  - Files: `comms/src/adapters/twilioSms.ts`
  - Depends on: 1.1
  - Acceptance: invalid number → 400 before API call; API failure → `accepted: false`
- [ ] **Task 1.3**: Peer dep + example-backend registration + docs
  - Description: optional peer `twilio`; env-gated registration; reference + env-var docs
  - Files: `comms/package.json`, `example-backend/src/server.ts`, `docs/reference/comms.md`, `docs/reference/environment-variables.md`
  - Depends on: 1.1
  - Acceptance: compile + boot without twilio installed when unconfigured

## Phase 2 — Delivery callbacks (gated on inbound-webhooks)

- [ ] **Task 2.1**: Status callback route
  - Description: webhook endpoint with Twilio signature verification via inbound-webhooks framework
  - Files: `comms/src/adapters/twilioSms.ts`, webhook registration
  - Depends on: inbound-webhooks IP
  - Acceptance: signed payload updates `CommsMessage.status`; unsigned rejected 401
