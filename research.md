# Research: Offline-First Mode for Terreno

## Summary

Terreno already has an offline foundation in `@terreno/rtk`: an `offlineSlice`, `createOfflineMiddleware`, a queue gate in `emptyApi`, server reachability probing, and a reusable `OfflineBanner` in `@terreno/ui`. The recommended direction is to harden those primitives into an opt-in offline-first framework for generated modelRouter CRUD endpoints before expanding into custom routes or domain-specific sync engines.

The v1 shape should keep the backend API surface small. `modelRouter` already exposes the important REST contract: create, list, read, update, delete, array push, array update, and array remove. The offline layer can infer model semantics from generated RTK Query endpoint names and app-provided endpoint configuration. Backend changes should be limited to making conflict detection and client-provided create IDs explicit and documented for modelRouter.

## Context

- **Problem:** Apps using Terreno should keep core CRUD workflows usable when the network is offline or unreliable, without requiring every app to hand-roll queue persistence, optimistic updates, auth token handling, conflict UI, and connection banners.
- **Business impact:** A reusable offline-first layer improves reliability for mobile/field workflows and makes Terreno apps feel faster by using RTK Query optimistic updates.
- **Affected packages:** `@terreno/rtk`, `@terreno/ui`, `@terreno/api`, `example-frontend`, and `example-backend`.
- **Constraints:** Default off, easy to enable, modelRouter-only v1, configurable connection quality, support custom ID strategies with good defaults, and avoid clearing RTK caches unless a user actually logs out.

## Findings

### Finding 1 - RTK already has a queue and offline state

`rtk/src/offlineSlice.ts` defines local-only offline state:

- `isOnline`
- `queue`
- `conflicts`
- `isSyncing`
- actions for enqueue/dequeue, conflict tracking, dismissing conflicts, and sync status

This is the right home for a v1 client-side offline model. The gap is that queue records are still too endpoint-centric and not explicit enough about modelRouter operation semantics, local temporary IDs, auth-blocked replay, or conflict resolution actions.

### Finding 2 - `createOfflineMiddleware` already intercepts and replays mutations

`rtk/src/offlineMiddleware.ts` uses listener middleware to:

- detect failed RTK Query mutations that look like network failures,
- enqueue configured offline mutations,
- apply an optimistic cache patch,
- replay queued mutations when `setOnlineStatus(true)` fires,
- add precondition headers for update conflict detection,
- record conflict entries when replay receives a conflict response.

The design should keep this middleware, but make its configuration more explicit:

- modelRouter endpoint descriptors instead of only endpoint-name lists,
- optimistic strategy hooks per model/endpoint,
- ID generation hooks for creates,
- conflict resolution helpers for "keep mine" and "use server",
- replay pause states for auth refresh failures.

### Finding 3 - `emptyApi` is the auth and offline gate integration point

`rtk/src/emptyApi.ts` already combines:

- base URL resolution,
- token header injection,
- token refresh with a mutex,
- 401 retry handling,
- mutation retry safety,
- `shouldDeferOfflineMutation` for offline-configured mutations.

The critical auth change is behavioral: failed refresh must not imply global cache reset. Queries/mutations should be held or marked auth-blocked while a refresh or re-auth attempt is in progress. The actual cache purge should only happen on an explicit `logout` action. This protects cached offline data and queued local changes from being lost during a train tunnel, expired access token, or temporarily unreachable refresh endpoint.

### Finding 4 - Backend modelRouter already has conflict-detection primitives

`api/src/api.ts` has modelRouter update handling for `If-Unmodified-Since` and `X-Unmodified-Since-ISO`. If the server document has changed since the client's known timestamp, the backend returns `409 Conflict` with the current server document.

That makes Last-Writer-Wins and explicit conflict resolution possible without a separate sync endpoint. The plan should formalize:

- which timestamp field is authoritative (`updated` by default),
- which header the client sends for queued updates,
- the shape of the `409` response,
- how clients convert a conflict into "keep mine" or "use server".

### Finding 5 - Existing UI components cover the first visible layer

`ui/src/OfflineBanner.tsx` exists and the example frontend already demonstrates `useServerStatus` and `OfflineBanner`. This should evolve into a more complete but still simple UI package:

- a status hook returning `online`, `spotty`, or `offline`,
- an offline/sync banner that can render all three states,
- a small conflict list/resolution component,
- low-level hooks so apps can build custom UI.

### Finding 6 - Connection quality should be derived, not hardcoded

The user asked to "add all three but make it configurable." The three inputs should be:

1. browser/native network reachability events,
2. health-check success/failure,
3. latency/intermittent failure metrics.

The client should expose thresholds and polling intervals. A default profile can classify:

- `online`: health checks succeed and latency is below threshold,
- `spotty`: browser says online but health checks intermittently fail or latency is high,
- `offline`: browser says offline or health checks repeatedly fail.

### Finding 7 - Optimistic creates need a client ID strategy

Optimistic creates need a stable local identifier before the server has confirmed the record. The plan should support:

- default client-generated ObjectId-compatible IDs for Mongoose modelRouter creates,
- an overridable `generateId` function per model,
- an ID reconciliation map when a server returns a different ID,
- local-only markers so UI can distinguish pending creates.

The lowest-friction default is to generate ObjectId-shaped strings on the client and send them as `_id` for modelRouter create requests when enabled for a model. That keeps list/read/update cache keys stable and avoids temporary ID churn.

## Options Considered

| Option | Description | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Harden existing RTK offline primitives | Extend `createOfflineMiddleware`, `offlineSlice`, `useServerStatus`, and UI components | Smallest surface, fits current architecture, works with generated hooks | Requires careful generic configuration | Yes |
| Add a backend sync endpoint | Add `/sync` APIs for batches, cursors, and conflict resolution | Powerful future model | Larger backend contract, harder to keep generic | Not for v1 |
| Use a third-party offline database/sync library | Add WatermelonDB/Realm/etc. | Mature local DB semantics | Heavy dependency, different app architecture | No for v1 |
| App-by-app custom queues | Let each app own offline behavior | Maximum flexibility | Duplicated bugs and inconsistent UX | No |

## Recommendation

Build offline-first v1 as an opt-in `@terreno/rtk` modelRouter offline framework:

1. **ModelRouter-only support first.** Apps configure the modelRouter endpoints that can be queued and replayed. Custom route support remains a future extension point through strategy interfaces.
2. **Client-only queue/conflict state.** Keep queue and conflicts in Redux persistence for v1; no server-side queue model.
3. **Good ID defaults with overrides.** Generate ObjectId-compatible IDs for optimistic creates by default, but expose per-model `generateId`.
4. **Auth is non-destructive.** Token refresh failures pause replay and mark sync as auth-blocked; caches and queues survive until explicit logout.
5. **Explicit conflict resolution.** Record conflicts with local and server versions. "Use server" drops the queued local mutation and patches cache to server. "Keep mine" updates the queued mutation with the latest server timestamp and replays it.
6. **Configurable connection quality.** `useServerStatus` becomes a richer status monitor using browser/network state, health checks, and latency/failure thresholds.
7. **Reusable UI with escape hatches.** Provide banners/hooks/conflict components, but keep low-level selectors and actions exported for custom app UI.

## Open Questions Answered

- **Should v1 support custom routes?** No. Start with modelRouter only, but keep the strategy API capable of custom routes later.
- **Should create IDs be configurable?** Yes, with a strong default.
- **Should auth refresh clear caches?** No. Only explicit logout clears auth and cache state.
- **What conflict choices are required?** Support "keep mine" and "use server" for v1.
- **Should connection states include online, spotty, offline?** Yes, and the thresholds should be configurable.

## References

- `rtk/src/offlineSlice.ts`
- `rtk/src/offlineMiddleware.ts`
- `rtk/src/offlineGate.ts`
- `rtk/src/useOfflineStatus.ts`
- `rtk/src/useServerStatus.ts`
- `rtk/src/emptyApi.ts`
- `rtk/src/authSlice.ts`
- `api/src/api.ts`
- `ui/src/OfflineBanner.tsx`
- `example-frontend/store/index.ts`
- `example-frontend/app/_layout.tsx`
- RTK Query manual cache update and optimistic update docs
- RTK Query cache persistence/rehydration docs
# Research: Consent Forms System for Terreno

## Summary
Terreno has all the building blocks to support a consent forms system: `modelRouter` for CRUD APIs, `AdminApp` for admin UI, `MarkdownView`/`SignatureField`/`CheckBox` in ui, and RTK Query for client hooks. The main work is defining the models (ConsentForm + ConsentResponse), creating a `ConsentApp` plugin for api, adding admin support, and building a `ConsentNavigator` component in ui that client apps import. The Flourish implementation provides a proven UX pattern to follow.

## Decisions Made

1. **Option A** — Full plugin across api+ui+rtk (not a separate package)
2. **Server-side form-to-user mapping** — Backend filters forms before sending to client
3. **Explicit versioning** — "Publish new version" action, not auto-version on edit
4. **No default forms** — Admin editor will have an AI-generate button using Terreno AI tooling
5. **Markdown editor** — New UI component (may be broken off into its own task first)

## Context
- **Problem:** Apps need consent workflows (legal agreements, HIPAA, privacy policies) but there's no reusable system in Terreno.
- **Current state:** Flourish has a working but hardcoded consent system — forms defined in constants, types enumerated, completion tracked on the User model. It works but isn't portable.
- **Goal:** A first-class, configurable consent system spanning all Terreno packages.

## Findings

### Finding 1 — API Patterns (modelRouter + TerrenoPlugin)

**modelRouter** (`api/src/api.ts:423-453`) generates full CRUD endpoints for any Mongoose model with permissions, hooks, validation, pagination, sorting, and OpenAPI spec generation.

**TerrenoPlugin** (`api/src/terrenoPlugin.ts`) is the extension point — `AdminApp`, `HealthApp`, and `BetterAuthApp` all implement it. A plugin gets `register(app)` and can mount arbitrary Express routes.

**Registration pattern** (example-backend):
```typescript
const terraApp = new TerrenoApp({userModel: User, ...})
  .register(todoRouter)            // modelRouter
  .register(new AdminApp({...}))   // plugin
  .start();
```

**Key hooks available on modelRouter:** `preCreate`, `postCreate`, `preUpdate`, `postUpdate`, `preDelete`, `postDelete`, `queryFilter`, `responseHandler`.

### Finding 2 — Admin Backend + Frontend

**AdminApp** (`admin-backend/src/adminApp.ts:121-206`) takes a `models` array and auto-generates:
- `GET /admin/config` — field metadata extracted from Mongoose schemas
- CRUD routes per model via `modelRouter` with `Permissions.IsAdmin`

**Admin frontend** auto-generates list/table/form views from the config response:
- `AdminModelList` — card grid of all models
- `AdminModelTable` — DataTable with pagination, sorting, actions
- `AdminModelForm` — auto-generated form from field metadata
- `AdminFieldRenderer` — renders fields by type (string->TextField, boolean->BooleanField, enum->SelectField, etc.)

**Gap:** No markdown editor field type exists. `AdminFieldRenderer` handles string/number/boolean/date/enum/objectid. For consent form markdown content, we need a new markdown editor component in UI.

### Finding 3 — UI Components Available

All needed UI primitives exist in `@terreno/ui`:

| Component | Use in Consents |
|-----------|----------------|
| `Page` | Consent form screen container |
| `MarkdownView` | Render consent form markdown content |
| `SignatureField` | Capture signatures |
| `CheckBox` | Optional toggles/checkboxes |
| `Button` | Agree/Disagree actions |
| `ScrollView` (via Page scroll) | Scroll-to-bottom tracking |
| `Box` | Layout |
| `Heading`/`Text` | Form title and instructions |

No existing navigator pattern for multi-step flows. `ConsentNavigator` would be new.

### Finding 4 — RTK Patterns for Client Hooks

**emptySplitApi** (`rtk/src/emptyApi.ts`) is the base API with auth token management. Client apps run `bun run sdk` to generate typed hooks from the backend's `/openapi.json`.

**generateTags** (`rtk/src/tagGenerator.ts`) auto-creates cache invalidation rules.

For the consent system, we'd export a custom hook like `useConsentForms(api)` from `@terreno/ui` that:
1. Fetches pending consent forms for the current user
2. Returns forms, loading state, and a submit function
3. Runs on every app launch

### Finding 5 — Flourish System Architecture (Reference)

**Models:** Consent stored as subdocuments on User (`consentFormAgreements[]` with consentFormId, type, isAgreed, agreedDate, signature, signedDate).

**Form definition:** Interface with `consentFormId`, `title`, `text` (function returning markdown), `consentFormType`, `captureSignature`, `requireScrollToBottom`.

**Types:** 8 types (patientAgreement, familyMemberAgreement, consent, transportation, research, privacy, hipaa, virginiaRights).

**Navigation flow:** App layout checks `useConsentForms()` -> if pending forms exist, redirects to `/(consent)` screen -> user completes one at a time -> PATCH user with agreement -> when all done, redirect to main app.

**Key patterns to keep:**
- Versioned forms (consentFormId as version number)
- Ordered display (show form A first, then B)
- Per-form type configuration (signature, scroll-to-bottom, checkboxes)
- Run-on-every-launch check

**Key patterns to change:**
- Forms in database (not hardcoded constants)
- Separate ConsentForm and ConsentResponse models (not subdocuments on User)
- Admin-editable markdown content
- Hook-based server-side mapping (user data -> which forms to show)

### Finding 6 — Proposed Data Model

**ConsentForm** (admin-managed):
- `title` (string, required)
- `slug` (string, unique identifier for form lineage)
- `content` (string/markdown, required)
- `type` (enum: agreement, privacy, hipaa, research, custom)
- `version` (number, explicit versioning)
- `order` (number, display ordering)
- `captureSignature` (boolean)
- `requireScrollToBottom` (boolean)
- `checkboxes` (array of {label, required})
- `buttons` (object: {agreeText, disagreeText, showDisagree})
- `active` (boolean)

**ConsentResponse** (user completions):
- `userId` (ObjectId, ref User)
- `consentFormId` (ObjectId, ref ConsentForm)
- `agreed` (boolean)
- `agreedAt` (Date)
- `signature` (string, base64)
- `signedAt` (Date)
- `checkboxValues` (Map of label->boolean)
- `metadata` (Mixed, for custom data from hooks)

### Finding 7 — Integration Points

**Backend (`@terreno/api`):**
- `ConsentApp` plugin implementing `TerrenoPlugin`
- Registers ConsentForm and ConsentResponse models + routes
- `GET /consents/pending` — returns pending forms for authenticated user (checks version, previous responses)
- `POST /consents/respond` — records a consent response
- Hook: `resolveConsentForms(user, allForms)` — server-side filtering of which forms to show based on user data

**Admin:**
- Register ConsentForm in AdminApp models array
- Custom markdown field renderer for content editing (new component, may be separate task)
- AI-generate button for creating consent form content

**Frontend (`@terreno/ui`):**
- `ConsentNavigator` — drop-in navigator component
- `ConsentFormScreen` — renders a single consent form (markdown + signature + checkboxes + buttons)
- `useConsentForms(api)` — hook that fetches pending forms, returns state + submit

**Client app integration:**
```typescript
import {ConsentNavigator} from "@terreno/ui";

<ConsentNavigator api={terrenoApi} onComplete={() => router.replace("/(tabs)")} />
```

## Key File Paths

| Feature | File |
|---------|------|
| modelRouter | `api/src/api.ts:423-453` |
| TerrenoPlugin interface | `api/src/terrenoPlugin.ts` |
| TerrenoApp class | `api/src/terrenoApp.ts:41-190` |
| Permissions | `api/src/permissions.ts` |
| OpenAPI generation | `api/src/openApi.ts` |
| AdminApp | `admin-backend/src/adminApp.ts:121-206` |
| AdminFieldRenderer | `admin-frontend/src/AdminFieldRenderer.tsx` |
| AdminModelForm | `admin-frontend/src/AdminModelForm.tsx` |
| useAdminApi | `admin-frontend/src/useAdminApi.ts` |
| MarkdownView | `ui/src/MarkdownView.tsx` |
| SignatureField | `ui/src/SignatureField.tsx` |
| CheckBox | `ui/src/CheckBox.tsx` |
| Page | `ui/src/Page.tsx` |
| emptySplitApi | `rtk/src/emptyApi.ts` |
| generateAuthSlice | `rtk/src/authSlice.ts` |
| generateTags | `rtk/src/tagGenerator.ts` |
| Example backend | `example-backend/src/server.ts` |
| Example frontend store | `example-frontend/store/sdk.ts` |
| Flourish consent forms | `~/src/flourish/backend/src/constants/consentForms.ts` |
| Flourish consent screen | `~/src/flourish/app/app/(consent)/index.tsx` |
| Flourish consent hook | `~/src/flourish/app/hooks/useConsentForms.ts` |
