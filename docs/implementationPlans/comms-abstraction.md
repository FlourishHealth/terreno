# Implementation Plan: Pluggable communications layer (@terreno/comms)

**Status:** Draft
**Priority:** High
**Effort:** Big batch
**Owner:** unassigned
**Created:** 2026-08-09
**Program:** [B2B platform](b2b-platform-program.md)
**Depends on:** none (inbound-webhooks is needed only by adapter delivery-callback phases)
**RTK deprecation flag:** None — backend-only package

## Goal

Terreno backends cannot send email, SMS, or push notifications: there is no mail
integration at all, `expo-server-sdk` sits unused in `@terreno/api`, and the RTK client's
`resetPassword` call has no backend to talk to. This IP creates `@terreno/comms`, a new
workspace package that defines **provider interfaces** for the four outbound channels
(mail, SMS, push, OTP verification), a **`CommsApp`** TerrenoPlugin that registers
configured providers and exposes send services to routes and other plugins, **push-token
registration** routes and model, a **delivery log**, and **console adapters** so every
channel works in development with zero external accounts.

Concrete providers (Twilio, Resend, Expo push) are separate IPs — one per adapter — so
consumer apps install only the SDKs they use.

## Non-Goals

- Any concrete provider SDK integration (see `comms-adapter-*` IPs).
- In-app notification center, inbox UI, or user notification preferences
  (`notification-center` item).
- Password reset / email verification flows (`password-reset-and-email-verification` item
  — a consumer of this layer).
- Inbound webhook handling (`inbound-webhooks` item); this IP only defines the
  `DeliveryEvent` type adapters will feed from callbacks.
- Broadcast/bulk campaign tooling.

## Decisions

| Question | Decision |
|----------|----------|
| New package or `@terreno/api` module? | New package `@terreno/comms`, mirroring `@terreno/feature-flags` — keeps provider SDKs out of the core dependency tree |
| How do provider SDKs stay optional? | Adapters live in subpath exports (`@terreno/comms/adapters/<name>`) with their SDKs as `peerDependencies` marked optional; core package has zero provider SDKs |
| Precedent to follow | `secretProviders.ts` (env + GCP behind one interface) and the OpenFeature provider in `@terreno/feature-flags` |
| Templates | Minimal: `{subject, text, html}` render helper with variable interpolation; no template builder |
| Where do send calls log? | `CommsMessage` Mongoose model, mirroring the `AIRequest.logRequest` pattern — logging failures never break the send |
| Dev experience | `ConsoleMailProvider` / `ConsoleSmsProvider` / `ConsolePushProvider` / `ConsoleVerificationProvider` print to logger and record to `CommsMessage`; default when no provider configured in non-production |

## Architecture

```
@terreno/comms
  src/
    types.ts            # Provider interfaces + message/result types
    commsApp.ts         # CommsApp TerrenoPlugin
    commsService.ts     # sendMail/sendSms/sendPush/startVerification/checkVerification
    models/
      commsMessage.ts   # Delivery log
      pushToken.ts      # Device push token registry
    routes/
      pushTokens.ts     # modelRouter for token registration
      commsExplorer.ts  # Admin-only delivery log explorer
    adapters/
      console.ts        # Dev adapters for all four channels
    templates.ts        # renderTemplate({subject, text, html}, data)
```

### Provider interfaces (types.ts)

```typescript
export interface SendResult {
  providerMessageId?: string;
  accepted: boolean;
  error?: string;
}

export interface MailMessage {
  to: string | string[];
  from?: string;            // default from CommsApp options
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  metadata?: Record<string, string>;
}

export interface MailProvider {
  readonly id: string;      // "console" | "resend" | ...
  sendMail(message: MailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly id: string;
  sendSms(message: {to: string; body: string}): Promise<SendResult>;
}

export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string | null;
}

export interface PushProvider {
  readonly id: string;
  sendPush(message: PushMessage): Promise<SendResult[]>; // one per token
}

export interface VerificationProvider {
  readonly id: string;
  startVerification(options: {to: string; channel: "sms" | "email"}): Promise<SendResult>;
  checkVerification(options: {to: string; code: string}): Promise<{valid: boolean}>;
}

export interface DeliveryEvent {
  channel: "mail" | "sms" | "push";
  providerMessageId: string;
  status: "delivered" | "bounced" | "failed" | "opened";
  raw?: unknown;
}
```

### CommsApp (TerrenoPlugin)

```typescript
export interface CommsOptions {
  mail?: MailProvider;
  sms?: SmsProvider;
  push?: PushProvider;
  verification?: VerificationProvider;
  defaultFrom?: string;                       // mail from fallback
  logMessages?: boolean;                      // default true → CommsMessage
  onDeliveryEvent?: (event: DeliveryEvent) => Promise<void>;
}

new TerrenoApp({userModel: User})
  .register(new CommsApp({mail: new ConsoleMailProvider(), push: new ExpoPushProvider()}))
  .start();
```

`CommsApp.register()` mounts the push-token routes and admin explorer;
`getCommsService()` (module-level accessor, mirroring how `FeatureFlagsApp` exposes
evaluation) gives routes and other plugins `sendMail` / `sendSms` / `sendPushToUser` /
`startVerification` / `checkVerification`. `sendPushToUser(userId, message)` resolves the
user's active `PushToken`s and prunes tokens the provider reports dead.

Unconfigured channel behavior: in production, throw `APIError({status: 501, title:
"Comms channel not configured"})`; in development, fall back to the console adapter with a
`logger.warn`.

## Models

All fields carry `description`; both models use `createdUpdatedPlugin` + `isDeletedPlugin`
and live per the five-type pattern (`CommsMessageDocument`, etc.).

**PushToken** — `userId` (ref User, required, indexed), `token` (string, required, unique),
`platform` ("ios" | "android" | "web"), `deviceId` (string, optional), `active` (boolean,
default true), `lastSeenAt` (date).

**CommsMessage** — `channel` ("mail" | "sms" | "push" | "verification"), `provider`
(string), `to` (string, redacted-at-rest for sms/mail per option), `subject` (string,
optional), `userId` (ref User, optional), `status` ("sent" | "failed" | "delivered" |
"bounced"), `providerMessageId` (string, indexed), `error` (string, optional), `metadata`
(Mixed). Static `logSend()` mirrors `AIRequest.logRequest`.

## APIs

| Method | Path | Permissions | Notes |
|---|---|---|---|
| POST | `/comms/pushTokens` | IsAuthenticated | Upsert by `token`; sets `userId`, `platform`, `lastSeenAt` |
| GET | `/comms/pushTokens` | IsOwner via queryFilter | List own device tokens |
| DELETE | `/comms/pushTokens/:id` | IsOwner | Deactivate on logout/uninstall |
| GET | `/comms/messages` | IsAdmin | Paginated delivery log explorer; filters: `channel`, `status`, `userId`, date range |

Push token routes via `modelRouter` with `preCreate` owner injection and
`OwnerQueryFilter`; explorer via `createOpenApiBuilder`, modeled on
`addAiRequestsExplorerRoutes`.

## Notifications

None beyond the feature itself.

## UI

None in this IP. example-frontend gains a settings row that registers the Expo push token
(client helper already exists in `store/utils.ts`) once the Expo adapter lands.

## Phases

1. **Package + contracts:** `@terreno/comms` package scaffold, `types.ts`, console
   adapters, `CommsMessage` + logging, `commsService`, unit tests.
2. **CommsApp + routes:** plugin registration, `PushToken` model + routes, admin explorer,
   OpenAPI, supertest coverage.
3. **Integration:** example-backend registers `CommsApp` (console adapters), seed docs,
   `docs/reference/comms.md`, catalog entries, publish wiring in `publish-on-tag.yml`.

## Feature Flags & Migrations

None. New collections only; no existing data touched.

## Activity Log & User Updates

Every send attempt is a `CommsMessage` row (that is the audit surface). No user-facing
updates.

## Not Included / Future Work

- Adapter IPs: `comms-adapter-expo-push`, `comms-adapter-twilio-sms`,
  `comms-adapter-twilio-verify`, `comms-adapter-resend` (D2), `comms-adapter-twilio-push`
  (blocked on Twilio GA).
- Notification center, user notification preferences.
- Queue-backed sending with retries — arrives with `job-queues`; until then sends are
  inline with one retry.

## Files to Create / Modify

- `comms/` (new workspace package: `package.json`, `tsconfig.json`, `biome.jsonc`, `src/*`
  as in Architecture)
- Root `package.json` — workspace entry + scripts (`comms:compile|lint|test`)
- `example-backend/src/server.ts` — register `CommsApp`
- `docs/reference/comms.md`, `.cursor/rules/comms/00-comms.mdc` (via rulesync)
- `.github/workflows/publish-on-tag.yml`, new `comms-ci` workflow

## Task List

See [docs/tasks/comms-abstraction.md](../tasks/comms-abstraction.md).

## Acceptance Criteria

- [ ] A Terreno app with only console adapters can call `sendMail`, `sendSms`,
      `sendPushToUser`, and `startVerification`/`checkVerification` in development, each
      producing a logger line and a `CommsMessage` row.
- [ ] `POST /comms/pushTokens` registers a device token for the authenticated user;
      re-posting the same token updates rather than duplicates; other users cannot list or
      delete it.
- [ ] `GET /comms/messages` is admin-only, paginated, and filterable by channel and status.
- [ ] Production apps with an unconfigured channel get a 501 `APIError`, not a silent no-op.
- [ ] `@terreno/comms` core has zero provider SDKs in `dependencies`.
- [ ] All routes appear in `/openapi.json` and the generated SDK compiles.
