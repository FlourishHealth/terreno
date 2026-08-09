# Implementation Plan: Comms adapter — transactional email (SendGrid)

**Status:** Draft
**Priority:** High
**Effort:** Small batch
**Owner:** unassigned
**Created:** 2026-08-09
**Program:** [B2B platform](b2b-platform-program.md)
**Depends on:** [comms-abstraction](comms-abstraction.md); inbound-webhooks (Phase 2 only)
**RTK deprecation flag:** None — backend only

## Goal

Implement `MailProvider` on Twilio SendGrid (decision D2 — first mail adapter, sharing the
Twilio account story with the SMS and Verify adapters) so `sendMail` delivers real
transactional email. This unblocks `password-reset-and-email-verification` and
`invitations-and-seats`.

## Non-Goals

- Other mail providers (Resend/SES/SMTP — items when demand appears).
- Marketing campaigns, contact lists, SendGrid dynamic template management.
- Inbound email parsing.

## Decisions

| Question | Decision |
|----------|----------|
| SDK | `@sendgrid/mail` as optional peer, subpath `@terreno/comms/adapters/sendgrid` |
| Auth | `SENDGRID_API_KEY` env or constructor option; fail fast at registration when missing |
| From address | Constructor `fromEmail`/`fromName` falling back to `CommsApp.defaultFrom`; sender verification is a documented SendGrid prerequisite, not automated |
| Templates | Terreno-side rendering (`templates.ts` from the abstraction) sent as `text`/`html`; SendGrid dynamic templates supported pass-through via `templateId` + `dynamicTemplateData` but not required |
| Sandbox | SendGrid `mail_settings.sandbox_mode` toggle for CI/e2e so tests never send |
| Delivery events | Phase 2: SendGrid Event Webhook (delivered/bounce/dropped/open) with ECDSA signature verification via the inbound-webhooks framework, mapped to `DeliveryEvent`s |

## Architecture

```typescript
// @terreno/comms/adapters/sendgrid
export class SendGridMailProvider implements MailProvider {
  readonly id = "sendgrid";
  constructor(options?: {
    apiKey?: string;          // default env SENDGRID_API_KEY
    fromEmail?: string;
    fromName?: string;
    sandboxMode?: boolean;    // default true when NODE_ENV === "test"
  });
  sendMail(message: MailMessage): Promise<SendResult>;
}
```

Error mapping: SendGrid 4xx (bad address, unverified sender) → `accepted: false` with the
response body's first error message in `SendResult.error` and full body in
`CommsMessage.metadata`; 429/5xx retried once by the core facade. The provider never
throws through `sendMail`.

## Models / APIs / Notifications / UI

None new. Phase 2 adds one webhook route via the inbound-webhooks framework.

## Phases

1. **Send path:** provider, config resolution, sandbox mode, error mapping, mocked-client
   tests; example-backend env-gated registration; docs (including the sender-verification
   prerequisite checklist).
2. **Delivery events** *(gated on inbound-webhooks IP)*: Event Webhook route with ECDSA
   signature verification; delivered/bounce/dropped/open → `DeliveryEvent` →
   `CommsMessage.status`.

## Feature Flags & Migrations

None.

## Activity Log & User Updates

All sends logged to `CommsMessage` with provider `sendgrid`.

## Not Included / Future Work

- Suppression-list management, unsubscribe groups.
- Batch sending beyond the multiple-recipient `to` array.

## Files to Create / Modify

- `comms/src/adapters/sendgrid.ts` + tests
- `comms/package.json` — optional peer `@sendgrid/mail`
- `example-backend/src/server.ts` — env-gated registration
- `docs/reference/comms.md`, `docs/reference/environment-variables.md`

## Task List

See [docs/tasks/comms-adapter-sendgrid.md](../tasks/comms-adapter-sendgrid.md).

## Acceptance Criteria

- [ ] `sendMail` delivers text/html mail with from-address fallback chain (provider option
      → `CommsApp.defaultFrom`), and passes `templateId`/`dynamicTemplateData` through when
      given.
- [ ] Sandbox mode is on by default under test and produces accepted results without real
      sends.
- [ ] SendGrid 4xx errors surface as `accepted: false` with the SendGrid error message;
      nothing throws through the facade.
- [ ] Missing API key fails fast at `CommsApp` registration with a clear error.
- [ ] Apps not using the adapter do not install `@sendgrid/mail`.
- [ ] (Phase 2) Event webhook updates `CommsMessage.status` only for
      signature-verified payloads.
