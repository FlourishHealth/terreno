# Implementation Plan: Signed Consent Links

**Status:** Planning
**Created:** 2026-06-15
**Target package(s):** `@terreno/api`, `@terreno/ui`, `@terreno/admin-frontend`, `example-backend`, `example-frontend`
**Depends on:** Consent Forms System (`consent-forms.md`, already shipped)

## Problem & Goal

Today a user can only complete consent forms while logged into the app: the
consent flow (`ConsentNavigator` → `ConsentFormScreen`) is gated behind an
authenticated session, and the backend endpoints (`GET /consents/pending`,
`POST /consents/respond`) resolve the acting user from `req.user` (a JWT
session). See `api/src/consentApp.ts`.

We want to let an admin (or the system) generate a **signed link associated
with a specific user** so that user can open the link and complete their
pending consent forms **without logging in**. This unblocks workflows like:

- Emailing a new client a consent packet before they have app credentials.
- Re-collecting consent after a form version bump for users who rarely log in.
- Capturing legally-required signatures from people who will never have a full
  account.

The link must be secure (scoped to one user, expiring, revocable, auditable),
must not grant a login session or access to any other data, and must reuse the
existing consent rendering/validation logic so behavior is identical to the
in-app flow.

## Research Summary

Key findings from the existing codebase (see `consent-forms.md` for the base
feature):

- **ConsentApp plugin** (`api/src/consentApp.ts`) mounts admin CRUD
  (`/consent-forms`, `/consent-responses`), user routes (`/consents/pending`,
  `/consents/respond`, `/consents/my`), and an optional `/consents/audit/:userId`
  route gated on `auditTrail`. Options are `auditTrail`, `aiConfig`,
  `resolveConsentForms`, `supportedLocales`.
- **Pending logic is inline** in the `GET /consents/pending` handler: fetch
  active forms → run `resolveConsentForms(user, forms)` → diff against the
  user's `ConsentResponse` rows by `formVersionSnapshot`. This needs to be
  **extracted into a shared helper** so the signed-link route can produce
  identical results for the link's target user.
- **Respond validation is inline** in `POST /consents/respond`: form active
  check, signature-required check, required-checkbox check, audit fields
  (`ipAddress`, `userAgent`, `contentSnapshot`, `formVersionSnapshot`). This
  must also be **extracted into a shared helper** that accepts an explicit
  `userId` instead of reading `req.user`.
- **Auth** (`api/src/auth.ts`): JWT via `jsonwebtoken`, secrets in
  `TOKEN_SECRET`. `decodeJWTMiddleware` lets unauthenticated requests pass
  through (`req.user` undefined) and explicitly passes through `Secret`-prefixed
  authorization headers. So **public (no-auth) routes simply omit
  `authenticateMiddleware()`** — no special wiring needed.
- **Models** use `createdUpdatedPlugin`, `isDeletedPlugin`, `findOneOrNone`,
  `findExactlyOne`, `{strict: "throw"}`, every field has a `description`, and
  types live in `api/src/types/*`. (See `mongoose-schema-safety` skill.)
- **Frontend** consent hooks (`ui/src/useConsentForms.ts`,
  `ui/src/useSubmitConsent.ts`) inject RTK endpoints onto a passed-in `api`
  with a `baseUrl`, cached per-api via `WeakMap`, tagged `PendingConsents`.
  `ConsentFormScreen` renders a single form and is reusable as-is.
- **Custom routes** must use `createOpenApiBuilder(options)` for OpenAPI docs +
  request validation (`configureOpenApiValidator` strips unknown props).

### Design decision: DB-backed token vs. stateless JWT

We choose a **DB-backed `ConsentLink` model storing a hashed random token**
rather than a self-contained JWT, because consent is legally sensitive and we
require:

- **Revocation** — an admin must be able to invalidate a sent link.
- **Audit** — who generated it, when it was used, from what IP, how many times.
- **Single-use / bounded-use** semantics — a JWT cannot be consumed.

The link carries a high-entropy random token (`randomBytes(32).toString("base64url")`).
We store only its SHA-256 hash (`tokenHash`), look up links by hashing the
incoming token, and never persist the raw token. A stateless-JWT variant is
listed under Not Included / Future Work.

## Models

### ConsentLink (new — `api/src/models/consentLink.ts`)

A revocable, auditable, per-user grant to complete a scoped set of consent
forms without a session.

```typescript
const consentLinkSchema = new mongoose.Schema<ConsentLinkDocument, ConsentLinkModel>(
  {
    consentFormIds: {
      // Empty/absent => all of the user's currently-pending forms.
      description: "Specific consent forms this link grants; empty means all pending forms for the user",
      ref: "ConsentForm",
      type: [mongoose.Schema.Types.ObjectId],
    },
    createdByUserId: {
      description: "Admin/user who generated this link (audit trail)",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
    expiresAt: {
      description: "Timestamp after which the link can no longer be used",
      index: true,
      required: true,
      type: Date,
    },
    lastUsedIp: {
      description: "IP address recorded the last time the link was used (audit)",
      type: String,
    },
    maxUses: {
      // 0 => unlimited until expiry; 1 => single-use (default).
      default: 1,
      description: "Maximum number of times the link may be used; 0 means unlimited until expiry",
      type: Number,
    },
    note: {
      description: "Optional admin note describing why the link was created",
      type: String,
    },
    revoked: {
      default: false,
      description: "Whether the link has been manually revoked by an admin",
      type: Boolean,
    },
    tokenHash: {
      description: "SHA-256 hash of the raw link token; the raw token is never stored",
      index: true,
      required: true,
      type: String,
      unique: true,
    },
    useCount: {
      default: 0,
      description: "Number of times the link has been successfully used to load or submit consents",
      type: Number,
    },
    usedAt: {
      description: "Timestamp the link was last successfully used",
      type: Date,
    },
    userId: {
      description: "The user this link allows to complete consents on behalf of",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

consentLinkSchema.plugin(createdUpdatedPlugin);
consentLinkSchema.plugin(isDeletedPlugin);
consentLinkSchema.plugin(findOneOrNone);
consentLinkSchema.plugin(findExactlyOne);
```

Types in `api/src/types/consentLink.ts` mirroring the `ConsentForm`/
`ConsentResponse` pattern (`ConsentLinkDocument`, `ConsentLinkModel`,
`ConsentLinkMethods`, `ConsentLinkStatics`).

**No changes** to `ConsentForm` or `ConsentResponse` schemas. ConsentResponses
created via a link are normal responses for `token.userId`; we additionally tag
them for provenance via a new optional field:

- Add `submittedViaLinkId?: ObjectId (ref ConsentLink)` to `ConsentResponse`
  (optional, with description) so audit views can show "submitted via signed
  link". This is an additive, nullable field — safe per `mongoose-schema-safety`.

## APIs

A new `signedLinks` option enables the feature (off by default — backwards
compatible):

```typescript
new ConsentApp({
  auditTrail: true,
  signedLinks: {
    enabled: true,
    // Where generated links point. The raw token is appended as ?token=...
    linkBaseUrl: "https://app.example.com/consents/sign",
    defaultExpiresIn: "14d", // parsed with `ms`, same as auth token TTLs
    // Optional: restrict who may generate links. Default: admin-only.
  },
})
```

### Admin / management routes (require auth; admin-only)

| Method | Path | Description | Permissions | Notes |
|--------|------|-------------|-------------|-------|
| POST | `/consents/links` | Generate a signed link for a user | IsAdmin | Body `{userId, consentFormIds?, expiresIn?, maxUses?, note?}`. Returns `{_id, url, token, expiresAt}` — **token returned exactly once** |
| GET | `/consents/links` | List/audit generated links | IsAdmin | Never returns `tokenHash` or raw token; supports `?userId=` filter, pagination |
| POST | `/consents/links/:id/revoke` | Revoke a link | IsAdmin | Sets `revoked: true` |

`GET`/list and read can be implemented with `modelRouter` (read-only, with a
`responseHandler` that strips `tokenHash`) or as a custom route; generate and
revoke are custom routes using `createOpenApiBuilder`.

### Public routes (NO authentication)

| Method | Path | Description | Permissions | Notes |
|--------|------|-------------|-------------|-------|
| GET | `/consents/link/:token` | Resolve a link → pending forms for its user | Public | Validates token (hash lookup, not expired/revoked, uses remaining). Returns `{forms, context}` where `context` is minimal (e.g. masked user display name, expiresAt). Increments no counters (read-only) |
| POST | `/consents/link/:token/respond` | Submit a consent response via the link | Public | Validates token, resolves `userId` from the link, runs the **shared respond helper** with that userId, records audit (`ipAddress`, `userAgent`), sets `submittedViaLinkId`, increments `useCount`/`usedAt`, enforces `maxUses` |

Token validation (shared helper `resolveConsentLink(token)`):
1. `tokenHash = sha256(token)`; `ConsentLink.findOneOrNone({tokenHash, deleted: false})`.
2. Not found → `404`.
3. `revoked` → `410 Gone`.
4. `expiresAt < now` → `410 Gone`.
5. `maxUses > 0 && useCount >= maxUses` → `410 Gone`.
6. Returns the link document.

Security properties:
- Token never returned after creation; only the hash is stored.
- A valid token only permits reading/submitting **that user's** pending
  consents — no session token is issued, no other endpoints are unlocked.
- Scope is further limited to `consentFormIds` when present.
- The respond helper reuses all existing validation (active form, required
  signature, required checkboxes) so behavior matches the in-app flow.
- `404`/`410` responses set `disableExternalErrorTracking: true` to avoid Sentry
  noise from scanners.

### Refactor (prerequisite, no behavior change)

Extract two helpers from `consentApp.ts` so both the authenticated routes and
the link routes share one implementation:

- `getPendingFormsForUser({user, resolveConsentForms, formIds?})` → the pending
  diff logic currently inline in `GET /consents/pending`.
- `recordConsentResponse({userId, body, form, auditTrail, req, submittedViaLinkId?})`
  → the create+validate logic currently inline in `POST /consents/respond`.

`GET /consents/pending` and `POST /consents/respond` are rewritten to call these
helpers; their existing tests must continue to pass unchanged.

## Notifications

No automatic delivery in v1. The admin receives the `url` in the
`POST /consents/links` response and is responsible for delivering it (email,
SMS, copy/paste). Emailing the link directly is listed under future work since
the repo has no shared email/notification sender wired into `@terreno/api`.

## UI

### `@terreno/ui`

| Component / hook | Description |
|------------------|-------------|
| `useConsentLink(api, token, baseUrl?)` | Injects `getConsentLink` (GET `/consents/link/:token`) and `submitConsentViaLink` (POST `/consents/link/:token/respond`) endpoints onto the passed api (same WeakMap-cache pattern as `useSubmitConsent`). Returns `{forms, context, isLoading, error, submit, isSubmitting, refetch}`. **No auth/session required.** |
| `ConsentLinkScreen` | Public screen that takes a `token` (+ `api`, `baseUrl?`). Loads the link, then renders the existing `ConsentFormScreen` sequentially for each pending form (mirrors `ConsentNavigator`'s sequencing but driven by the link endpoints rather than `/consents/pending`). Handles loading, invalid/expired/revoked (friendly message), and an all-complete "Thank you" state. Locale detection same as `useConsentForms`. |

`ConsentFormScreen` is reused unchanged. Sequencing logic from
`ConsentNavigator` should be factored so `ConsentLinkScreen` and
`ConsentNavigator` share it where practical (otherwise a thin parallel
implementation is acceptable).

### `@terreno/admin-frontend`

| Component | Description |
|-----------|-------------|
| `GenerateConsentLinkModal` | Modal launched from the consent admin surface (and/or `ConsentResponseViewer`). Inputs: target user (id/email), optional form multiselect, `expiresIn`, `maxUses`, note. Calls `POST /consents/links`, then displays the returned `url` with a copy-to-clipboard button and a clear "this link is shown only once" warning. |
| `ConsentLinkList` (optional) | Read-only table of generated links (user, created, expiresAt, useCount, revoked) with a revoke action, backed by `GET /consents/links` + `POST /consents/links/:id/revoke`. |

### Client navigation flow

```
Admin: Consent admin → "Generate signed link" → GenerateConsentLinkModal
  → POST /consents/links → copy URL → deliver to user (email/SMS/etc.)

Recipient (no login):
  Open {linkBaseUrl}?token=XYZ
   → ConsentLinkScreen
     → GET /consents/link/XYZ  → pending forms + context
     → render ConsentFormScreen for forms[0..n] sequentially
       → POST /consents/link/XYZ/respond per form
     → all complete → "Thank you" state
   → invalid/expired/revoked → friendly error (no app access)
```

## Phases

| Phase | Contents | Deliverable |
|-------|----------|-------------|
| **Phase 0: Refactor** | Extract `getPendingFormsForUser` and `recordConsentResponse` helpers; rewire existing routes; existing tests green | No behavior change; shared logic ready |
| **Phase 1: Model + management API** | `ConsentLink` model + types, `submittedViaLinkId` on `ConsentResponse`, token utils (hash/generate), `signedLinks` option, generate/list/revoke routes, exports, tests | Admins can mint/revoke/audit links |
| **Phase 2: Public API** | `GET /consents/link/:token`, `POST /consents/link/:token/respond`, shared validation reuse, use-count/audit, tests | Links usable end-to-end via HTTP |
| **Phase 3: UI** | `useConsentLink` hook, `ConsentLinkScreen`, exports, tests | Frontend public consent-by-link screen |
| **Phase 4: Admin UI** | `GenerateConsentLinkModal` (+ optional `ConsentLinkList`), exports | Admins generate links in-app |
| **Phase 5: Example app + docs + SDK** | Wire `signedLinks` in example-backend, public `app/consents/sign.tsx` route (outside auth gate), admin button, `bun run sdk`, how-to doc, rulesync | Working end-to-end example |

Phases 3 and 4 can run in parallel after Phase 2. Phase 0 must land first.

## Feature Flags & Migrations

- **Feature flag / gating:** The entire feature is gated behind
  `signedLinks.enabled` in `ConsentApp` options; default off. When disabled, no
  link routes are registered and behavior is identical to today.
- **Migrations:** None required. `ConsentLink` is a new collection.
  `ConsentResponse.submittedViaLinkId` is additive and nullable (safe per
  `mongoose-schema-safety`). Add indexes on `tokenHash` (unique), `userId`,
  `expiresAt`.
- **Env:** No new required env vars. Token hashing uses Node `crypto`. If a
  stateless-JWT variant were chosen later it would need a dedicated secret; not
  in scope.
- **Rollout:** Ship each phase as it lands; keep disabled in production until
  Phase 5 verification passes.

## Activity Log & User Updates

The `ConsentLink` document is itself the audit record (createdByUserId,
useCount, usedAt, lastUsedIp, revoked). ConsentResponses created via a link are
marked with `submittedViaLinkId` and still appear in `GET /consents/audit/:userId`
and `GET /consents/my`. No separate activity-log system is introduced.

## Not Included / Future Work

- **Email/SMS delivery** of the link from the backend (no shared sender exists).
- **Stateless JWT links** (no DB row) as an alternative token strategy.
- **Rate limiting / abuse protection** middleware on the public routes (note in
  docs; rely on platform-level rate limiting for now).
- **Bulk link generation** for many users at once.
- **Per-link branding / custom landing copy.**
- **OTP / second-factor step** before showing forms (e.g. confirm DOB).
- **Webhook/notification** when a link is consumed.

---

## Task List (Bot Consumption)

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable.* See `docs/tasks/consent-signed-links.md`.
