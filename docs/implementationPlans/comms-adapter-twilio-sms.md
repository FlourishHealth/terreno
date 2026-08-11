# Implementation Plan: Comms adapter — Twilio SMS

**Status:** Draft
**Roadmap issue:** https://github.com/FlourishHealth/terreno/issues/1020
**Priority:** Medium
**Effort:** Small batch
**Owner:** unassigned
**Created:** 2026-08-09
**Program:** [B2B platform](b2b-platform-program.md)
**Depends on:** [comms-abstraction](comms-abstraction.md); inbound-webhooks (Phase 2 only)
**RTK deprecation flag:** None — backend only

## Goal

Implement `SmsProvider` on Twilio Programmable Messaging so Terreno apps can send
transactional SMS (OTP fallback, alerts, invitation nudges) through the `@terreno/comms`
facade with delivery logging.

## Non-Goals

- OTP verification (that is `comms-adapter-twilio-verify`, on Twilio Verify).
- Push via Twilio (dropped by decision D5 — Expo push is the push adapter).
- Bulk/campaign messaging, MMS/RCS.
- Phone-number provisioning automation.

## Decisions

| Question | Decision |
|----------|----------|
| SDK | `twilio` as optional peer, subpath `@terreno/comms/adapters/twilioSms` |
| Sender config | Prefer `TWILIO_MESSAGING_SERVICE_SID`; fall back to `TWILIO_FROM_NUMBER`; constructor options override env |
| Number validation | Validate/normalize to E.164 with `libphonenumber-js` (already in catalog) before hitting the API |
| Delivery status | Phase 2: status callback endpoint via the inbound-webhooks framework mapping Twilio statuses to `DeliveryEvent`s |
| Secrets | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` via env or the existing secret-provider layer |

## Architecture

```typescript
// @terreno/comms/adapters/twilioSms
export class TwilioSmsProvider implements SmsProvider {
  readonly id = "twilio";
  constructor(options?: {
    accountSid?: string;      // default env TWILIO_ACCOUNT_SID
    authToken?: string;       // default env TWILIO_AUTH_TOKEN
    messagingServiceSid?: string;
    fromNumber?: string;
    statusCallbackUrl?: string; // Phase 2
  });
  sendSms(message: {to: string; body: string}): Promise<SendResult>;
}
```

Errors map Twilio exception codes to `SendResult.error` with the Twilio error code kept in
`CommsMessage.metadata` for triage. Invalid destination numbers fail fast with a
`BadRequestError` before any API call.

## Models / APIs / Notifications / UI

None new — Phase 2 adds one webhook route via the inbound-webhooks framework.

## Phases

1. **Send path:** provider, config resolution, E.164 validation, error mapping, tests with
   mocked Twilio client; example-backend env-gated registration; docs.
2. **Delivery callbacks** *(gated on inbound-webhooks IP)*: status callback route with
   Twilio signature verification, statuses → `DeliveryEvent` → `CommsMessage.status`
   updates.

## Feature Flags & Migrations

None.

## Activity Log & User Updates

All sends logged to `CommsMessage` with provider `twilio`.

## Not Included / Future Work

- Inbound SMS (replies) handling.
- Alphanumeric sender IDs, international compliance tooling.

## Files to Create / Modify

- `comms/src/adapters/twilioSms.ts` + tests
- `comms/package.json` — optional peer `twilio`
- `example-backend/src/server.ts` — env-gated registration
- `docs/reference/comms.md`, `docs/reference/environment-variables.md`

## Task List

See [docs/tasks/comms-adapter-twilio-sms.md](../tasks/comms-adapter-twilio-sms.md).

## Acceptance Criteria

- [ ] `sendSms` delivers via messaging service or from-number config, preferring the
      messaging service when both are present.
- [ ] A non-E.164 destination fails with a 400 `APIError` before any Twilio call.
- [ ] Twilio API errors produce `accepted: false` results with the Twilio error code in
      `CommsMessage.metadata`; nothing throws through the facade.
- [ ] Apps not using the adapter do not install the `twilio` SDK.
- [ ] (Phase 2) Status callbacks flip `CommsMessage.status` to `delivered`/`failed` with
      verified Twilio signatures.
