# Tasks: Comms adapter — transactional email (SendGrid)

IP: [comms-adapter-sendgrid](../implementationPlans/comms-adapter-sendgrid.md)

## Phase 1 — Send path

- [ ] **Task 1.1**: `SendGridMailProvider` with config + sandbox mode
  - Description: constructor/env config, from-address fallback chain, sandbox default under test
  - Files: `comms/src/adapters/sendgrid.ts`
  - Depends on: comms-abstraction Phase 1
  - Acceptance: mocked-client tests for text/html/template sends
- [ ] **Task 1.2**: Error mapping
  - Description: 4xx → `accepted: false` + message; full response body into `CommsMessage.metadata`; never throws
  - Files: `comms/src/adapters/sendgrid.ts`
  - Depends on: 1.1
  - Acceptance: unverified-sender and bad-address fixtures covered
- [ ] **Task 1.3**: Peer dep + registration + docs
  - Description: optional peer `@sendgrid/mail`; env-gated example-backend registration with fail-fast; reference + env docs incl. sender-verification checklist
  - Files: `comms/package.json`, `example-backend/src/server.ts`, `docs/reference/comms.md`, `docs/reference/environment-variables.md`
  - Depends on: 1.1
  - Acceptance: boot without key skips registration; compile passes without the SDK installed

## Phase 2 — Delivery events (gated on inbound-webhooks)

- [ ] **Task 2.1**: Event Webhook route
  - Description: ECDSA signature verification via inbound-webhooks; delivered/bounce/dropped/open → `DeliveryEvent`
  - Files: `comms/src/adapters/sendgrid.ts`, webhook registration
  - Depends on: inbound-webhooks IP
  - Acceptance: signed fixture updates `CommsMessage.status`; unsigned rejected 401
