# Tasks: Pluggable communications layer (@terreno/comms)

IP: [comms-abstraction](../implementationPlans/comms-abstraction.md)

## Phase 1 — Package + contracts

- [x] **Task 1.1**: Scaffold `@terreno/comms` workspace package
  - Description: `comms/` package with tsconfig/biome/bun test setup mirroring `feature-flags/`; root workspace entry + `comms:*` scripts
  - Files: `comms/package.json`, `comms/tsconfig.json`, `comms/biome.jsonc`, root `package.json`
  - Depends on: none
  - Acceptance: `bun run comms:compile` and `bun run comms:lint` pass
- [ ] **Task 1.2**: Provider interfaces and message types
  - Description: `MailProvider`, `SmsProvider`, `PushProvider`, `VerificationProvider`, `SendResult` (incl. `errorCode`/`errorClass`), `DeliveryEvent`, `CommsHookContext`, `OptOutEvent` per IP
  - Status: base provider/message contracts shipped; `errorCode`/`errorClass`, `CommsHookContext`, and `OptOutEvent` remain
  - Files: `comms/src/types.ts`
  - Depends on: 1.1
  - Acceptance: types compile and are exported
- [x] **Task 1.3**: Console adapters
  - Description: dev adapters for all four channels logging via `logger.info`
  - Files: `comms/src/adapters/console.ts` + tests
  - Depends on: 1.2
  - Acceptance: each adapter returns `accepted: true` and logs
- [ ] **Task 1.4**: `CommsMessage` model + `logSend`
  - Description: delivery log model with five-type pattern, `description` on every field, plugins, static `logSend` that never throws; dashboard-ready fields (`errorCode`, `errorClass`, `attempts[]`, `attemptCount`, `lastAttemptAt`, `retriedFromId`/`retriedById`, `templateId`, retained `payload`)
  - Files: `comms/src/models/commsMessage.ts` + tests
  - Depends on: 1.1
  - Acceptance: send logging survives a forced model error (logged, not thrown); attempts append per attempt
  - Status: model and non-throwing `logSend` shipped; dashboard-ready fields remain
- [ ] **Task 1.5**: `commsService` send facade
  - Description: `sendMail`/`sendSms`/`sendPushToUser`/`startVerification`/`checkVerification`; template render helper; unconfigured-channel behavior (501 in prod, console fallback in dev); inline retry on `errorClass: "transient"` only
  - Status: send facade, templates, and unconfigured-channel behavior shipped; inline transient retry remains
  - Files: `comms/src/commsService.ts`, `comms/src/templates.ts` + tests
  - Depends on: 1.2, 1.3, 1.4
  - Acceptance: unit tests cover happy path + unconfigured channel in both env modes; permanent failures do not retry
- [ ] **Task 1.6**: Lifecycle hooks
  - Description: `beforeSend` (mutate/cancel), `onSend`, `onError`, `onRetry`, `onOptOut`, `onDeliveryEvent` wiring in the facade; every hook wrapped so a throw is logged and never changes the send outcome
  - Files: `comms/src/commsService.ts` + tests
  - Depends on: 1.5
  - Acceptance: one test per hook (fires with correct context) plus one throwing-hook test per hook
- [ ] **Task 1.7**: Payload retention + redaction
  - Description: `retainPayloadDays` (default 30) storage of rendered payload post-`redactPayload`; expiry cleanup clears `payload` without touching the log row
  - Files: `comms/src/commsService.ts`, `comms/src/models/commsMessage.ts` + tests
  - Depends on: 1.4, 1.5
  - Acceptance: payload stored redacted; expired payload cleared; `retainPayloadDays: 0` stores nothing

## Phase 2 — CommsApp + routes

- [x] **Task 2.1**: `PushToken` model
  - Description: model per IP with unique token upsert semantics
  - Files: `comms/src/models/pushToken.ts` + tests
  - Depends on: 1.1
  - Acceptance: duplicate token registration updates the existing row
- [x] **Task 2.2**: `CommsApp` TerrenoPlugin
  - Description: options wiring, `getCommsService()` accessor, route mounting on `register()`
  - Files: `comms/src/commsApp.ts` + tests
  - Depends on: 1.5, 2.1
  - Acceptance: plugin registers on `TerrenoApp` and service accessor returns configured providers
- [x] **Task 2.3**: Push token routes
  - Description: custom idempotent registration/list/deactivation endpoints plus modelRouter owner read; persisted `userId` scoping
  - Files: `comms/src/routes/pushTokens.ts` + supertest
  - Depends on: 2.2
  - Acceptance: acceptance criteria bullets 2 pass under supertest
- [x] **Task 2.4**: Admin delivery explorer
  - Description: `GET /comms/messages` admin-only, paginated, filtered; OpenAPI builder
  - Files: `comms/src/routes/commsExplorer.ts` + supertest
  - Depends on: 2.2
  - Acceptance: non-admin gets 403; filters work
- [x] **Task 2.5**: `sendPushToUser` token resolution + pruning
  - Description: resolve active tokens per user; deactivate tokens whose `SendResult` reports permanent failure
  - Files: `comms/src/commsService.ts` + tests
  - Depends on: 2.1, 1.5
  - Acceptance: dead token is `active: false` after a failed send

## Phase 3 — Integration + docs

- [x] **Task 3.1**: example-backend registration
  - Description: register `CommsApp` with console adapters; env-gated
  - Files: `example-backend/src/server.ts`
  - Depends on: 2.2
  - Acceptance: backend boots; `/comms/pushTokens` in `/openapi.json`
- [x] **Task 3.2**: Reference docs + rules
  - Description: `docs/reference/comms.md`, rulesync source rule, `bun run rules`
  - Files: `docs/reference/comms.md`, `.rulesync/**`
  - Depends on: 2.x
  - Acceptance: `bun run rules:check` passes
- [x] **Task 3.3**: CI + publish wiring
  - Description: `comms-ci` workflow; add `@terreno/comms` to `publish-on-tag.yml`
  - Files: `.github/workflows/comms-ci.yml`, `.github/workflows/publish-on-tag.yml`
  - Depends on: 1.x
  - Acceptance: CI green on the PR
