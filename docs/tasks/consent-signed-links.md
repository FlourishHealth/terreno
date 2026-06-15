# Task List: Signed Consent Links

*Structured task breakdown for automated implementation. Each task should be independently implementable and testable. See `docs/implementationPlans/consent-signed-links.md` for full context.*

## Phase 0: Refactor (no behavior change)

- [ ] **Task 0.1**: Extract `getPendingFormsForUser` helper
  - Description: Move the pending-form diff logic currently inline in the `GET /consents/pending` handler in `api/src/consentApp.ts` into a reusable function `getPendingFormsForUser({user, resolveConsentForms, formIds?})`. It fetches active forms, optionally restricts to `formIds`, runs `resolveConsentForms`, and filters against the user's existing `ConsentResponse` rows by `formVersionSnapshot`. Rewire `GET /consents/pending` to call it.
  - Files: `api/src/consentApp.ts` (optionally a new `api/src/consentHelpers.ts`)
  - Depends on: none
  - Acceptance: Existing `consentApp.test.ts` pending tests pass unchanged; helper accepts an explicit user and optional `formIds`.

- [ ] **Task 0.2**: Extract `recordConsentResponse` helper
  - Description: Move the validate-and-create logic from `POST /consents/respond` into `recordConsentResponse({userId, body, form, auditTrail, req, submittedViaLinkId?})`. Preserve all current validation (form active, required signature, required checkboxes) and audit field capture. Rewire `POST /consents/respond` to call it with `userId = req.user.id`.
  - Files: `api/src/consentApp.ts` (or `api/src/consentHelpers.ts`)
  - Depends on: none
  - Acceptance: Existing respond tests pass unchanged; helper creates a response for an explicit userId and supports an optional `submittedViaLinkId`.

## Phase 1: Model + Management API

- [ ] **Task 1.1**: ConsentLink model + types
  - Description: Create `ConsentLink` schema with fields userId, consentFormIds, expiresAt, maxUses (default 1), useCount (default 0), usedAt, revoked (default false), createdByUserId, lastUsedIp, note, tokenHash (unique, indexed). Add `{strict: "throw"}`, plugins (createdUpdated, isDeleted, findOneOrNone, findExactlyOne), a `description` on every field, and indexes on tokenHash (unique), userId, expiresAt. Add types in `api/src/types/consentLink.ts`.
  - Files: `api/src/models/consentLink.ts`, `api/src/types/consentLink.ts`
  - Depends on: none
  - Acceptance: Model imports and validates; `checkModelsStrict` passes; unique index on tokenHash created.

- [ ] **Task 1.2**: Add `submittedViaLinkId` to ConsentResponse
  - Description: Add an optional, nullable `submittedViaLinkId` (ref ConsentLink) field with a description to the ConsentResponse schema and its Document type. Additive only — no migration.
  - Files: `api/src/models/consentResponse.ts`, `api/src/types/consentResponse.ts`
  - Depends on: 1.1
  - Acceptance: Field is optional; existing response creation paths unaffected; `checkModelsStrict` passes.

- [ ] **Task 1.3**: Token utilities
  - Description: Add helpers to generate a high-entropy raw token (`randomBytes(32).toString("base64url")`) and to hash a token with SHA-256 (`hashConsentLinkToken(token)`). Never store the raw token. Pure functions, unit-tested.
  - Files: `api/src/consentHelpers.ts` (or `api/src/consentLinkTokens.ts`)
  - Depends on: none
  - Acceptance: Generation produces URL-safe tokens; hashing is deterministic; raw token is recoverable only by the caller at creation time.

- [ ] **Task 1.4**: `signedLinks` option on ConsentApp
  - Description: Extend `ConsentAppOptions` with `signedLinks?: {enabled: boolean; linkBaseUrl: string; defaultExpiresIn?: string; }`. When `enabled` is false/absent, register no link routes (no behavior change). Parse `defaultExpiresIn`/per-request `expiresIn` with `ms` (same approach as auth TTLs).
  - Files: `api/src/consentApp.ts`
  - Depends on: 1.1
  - Acceptance: Plugin builds with and without `signedLinks`; disabled config registers no `/consents/links*` or `/consents/link/*` routes.

- [ ] **Task 1.5**: POST /consents/links (generate)
  - Description: Admin-only custom route (createOpenApiBuilder). Body `{userId, consentFormIds?, expiresIn?, maxUses?, note?}`. Validate user exists. Generate raw token, store SHA-256 hash, compute `expiresAt` from `expiresIn`/`defaultExpiresIn`, set `createdByUserId = req.user.id`. Return `{_id, url, token, expiresAt}` where `url = ${linkBaseUrl}?token=${token}`. Token returned exactly once.
  - Files: `api/src/consentApp.ts`
  - Depends on: 1.1, 1.3, 1.4
  - Acceptance: Admin can mint a link; raw token only in the create response; `tokenHash` stored, raw token not persisted; non-admin blocked.

- [ ] **Task 1.6**: GET /consents/links (list/audit) + POST /consents/links/:id/revoke
  - Description: Admin-only list of links (supports `?userId=`, pagination) that never exposes `tokenHash`/raw token — use a `responseHandler` (or custom route) to strip it. Add revoke route that sets `revoked: true`.
  - Files: `api/src/consentApp.ts`
  - Depends on: 1.1, 1.4
  - Acceptance: List excludes token fields; revoke flips `revoked`; both admin-only.

- [ ] **Task 1.7**: Export ConsentLink from @terreno/api
  - Description: Export `ConsentLink` model and its types from `api/src/index.ts`.
  - Files: `api/src/index.ts`
  - Depends on: 1.1
  - Acceptance: `import {ConsentLink} from "@terreno/api"` works.

- [ ] **Task 1.8**: Management API tests
  - Description: Test generate (admin-only, returns token once, stores hash not raw, honors expiresIn/maxUses/note), list (no token leakage, userId filter), revoke (admin-only, flips flag). Use supertest + bun test following `consentApp.test.ts` patterns.
  - Files: `api/src/consentApp.test.ts` (or `consentLinks.test.ts`)
  - Depends on: 1.5, 1.6
  - Acceptance: All cases pass including non-admin rejection and token-leak assertions.

## Phase 2: Public API

- [ ] **Task 2.1**: `resolveConsentLink(token)` validation helper
  - Description: Hash incoming token, look up `ConsentLink` by `tokenHash` (not deleted). Throw `404` if not found, `410 Gone` if revoked, expired (`expiresAt < now`), or uses exhausted (`maxUses > 0 && useCount >= maxUses`). Set `disableExternalErrorTracking: true` on these errors. Return the link document.
  - Files: `api/src/consentHelpers.ts`
  - Depends on: 1.1, 1.3
  - Acceptance: Each invalid state yields the correct status; valid token returns the link.

- [ ] **Task 2.2**: GET /consents/link/:token (public)
  - Description: Public route (no `authenticateMiddleware`). Validate via `resolveConsentLink`, load the link's user, call `getPendingFormsForUser({user, resolveConsentForms, formIds: link.consentFormIds})`. Return `{data: {forms, context}}` where context exposes only minimal info (e.g. masked display name, expiresAt, formCount). Read-only — does not mutate counters. OpenAPI docs via createOpenApiBuilder.
  - Files: `api/src/consentApp.ts`
  - Depends on: 0.1, 2.1
  - Acceptance: Returns the target user's pending forms (scoped by consentFormIds); no session token issued; invalid/expired/revoked tokens rejected.

- [ ] **Task 2.3**: POST /consents/link/:token/respond (public)
  - Description: Public route. Validate via `resolveConsentLink`, then call `recordConsentResponse({userId: link.userId, body, form, auditTrail, req, submittedViaLinkId: link._id})`. If `consentFormIds` is set, enforce the submitted `consentFormId` is in scope. On success increment `useCount`, set `usedAt` + `lastUsedIp`; enforce `maxUses`. OpenAPI docs via createOpenApiBuilder.
  - Files: `api/src/consentApp.ts`
  - Depends on: 0.2, 2.1
  - Acceptance: Creates a ConsentResponse for the link's user with `submittedViaLinkId`; out-of-scope formId rejected; single-use links reject the second use with 410.

- [ ] **Task 2.4**: Public API tests
  - Description: Test load (valid token returns pending forms; expired/revoked/exhausted rejected; unknown token 404), respond (creates response for link user, marks audit + submittedViaLinkId, increments useCount, enforces maxUses and scope), and that no auth header is required. Include a regression test that the same form submitted via link appears in `/consents/audit/:userId`.
  - Files: `api/src/consentApp.test.ts` (or `consentLinks.test.ts`)
  - Depends on: 2.2, 2.3
  - Acceptance: All cases pass; coverage does not regress.

## Phase 3: UI (@terreno/ui)

- [ ] **Task 3.1**: `useConsentLink` hook
  - Description: Hook that injects `getConsentLink` (GET `/consents/link/:token`) and `submitConsentViaLink` (POST `/consents/link/:token/respond`) endpoints onto the passed `api` with optional `baseUrl`, using the WeakMap-per-api cache pattern from `useSubmitConsent.ts`. Returns `{forms, context, isLoading, error, submit, isSubmitting, refetch}`. Detect device locale like `useConsentForms`. Works without an auth session.
  - Files: `ui/src/useConsentLink.ts`, `ui/src/useConsentLink.test.ts`, `ui/src/index.tsx`
  - Depends on: Phase 2
  - Acceptance: Hook loads forms and submits via the token endpoints; loading/error states handled; exported from `@terreno/ui`.

- [ ] **Task 3.2**: `ConsentLinkScreen` component
  - Description: Public screen taking `{token, api, baseUrl?, onComplete?}`. Uses `useConsentLink`. States: loading (Spinner), invalid/expired/revoked (friendly message, no app access), displaying (render existing `ConsentFormScreen` for forms sequentially, advancing on each successful submit), complete ("Thank you"). Reuse `ConsentFormScreen` unchanged; reuse `ConsentNavigator` sequencing where practical.
  - Files: `ui/src/ConsentLinkScreen.tsx`, `ui/src/ConsentLinkScreen.test.tsx`, `ui/src/index.tsx`
  - Depends on: 3.1
  - Acceptance: Renders forms in order, submits each, shows completion; error states render correctly; tests via `renderWithTheme` with mocked api.

## Phase 4: Admin UI (@terreno/admin-frontend)

- [ ] **Task 4.1**: `GenerateConsentLinkModal` component
  - Description: Modal with inputs for target user (id/email), optional form multiselect, `expiresIn`, `maxUses`, note. Calls `POST /consents/links` via an injected RTK mutation, then shows the returned `url` with a copy-to-clipboard button and a "shown only once" warning. Handles loading/error.
  - Files: `admin-frontend/src/GenerateConsentLinkModal.tsx`, `admin-frontend/src/index.tsx`
  - Depends on: Phase 1
  - Acceptance: Generates a link, displays + copies URL, surfaces errors; importable from `@terreno/admin-frontend`.

- [ ] **Task 4.2**: (Optional) `ConsentLinkList` component
  - Description: Read-only DataTable of generated links (user, created, expiresAt, useCount, revoked) with a revoke action backed by `GET /consents/links` and `POST /consents/links/:id/revoke`.
  - Files: `admin-frontend/src/ConsentLinkList.tsx`, `admin-frontend/src/index.tsx`
  - Depends on: Phase 1
  - Acceptance: Lists links without exposing tokens; revoke works; exported.

## Phase 5: Example App + Docs + SDK

- [ ] **Task 5.1**: Enable signedLinks in example-backend
  - Description: Add `signedLinks: {enabled: true, linkBaseUrl: ..., defaultExpiresIn: "14d"}` to the `ConsentApp` registration in `example-backend/src/server.ts`. Optionally register `ConsentLink` in the AdminApp models list (read-only listFields, token fields hidden).
  - Files: `example-backend/src/server.ts`
  - Depends on: Phase 1, Phase 2
  - Acceptance: Backend serves link routes; OpenAPI spec includes them; admin can view links.

- [ ] **Task 5.2**: Public sign route in example-frontend
  - Description: Add an Expo Router route `example-frontend/app/consents/sign.tsx` that reads `?token=` and renders `ConsentLinkScreen` with `terrenoApi`. Ensure this route is reachable **without** authentication (outside the auth-gated layout / redirect logic in `app/_layout.tsx`).
  - Files: `example-frontend/app/consents/sign.tsx`, `example-frontend/app/_layout.tsx`
  - Depends on: Phase 3, 5.1
  - Acceptance: Opening the route with a valid token shows the consent flow with no login; invalid token shows the error state.

- [ ] **Task 5.3**: Admin generate-link entry point in example-frontend
  - Description: Add a "Generate signed link" action (button) to the consent admin area and/or `ConsentResponseViewer` that opens `GenerateConsentLinkModal`.
  - Files: `example-frontend/app/admin/consent-responses/[id].tsx` (or a consent admin index), as appropriate
  - Depends on: Phase 4, 5.1
  - Acceptance: Admin can generate and copy a link end-to-end in the example app.

- [ ] **Task 5.4**: Regenerate SDK
  - Description: With backend running, run `bun run sdk` in `example-frontend` to include the new link endpoints/types in `store/openApiSdk.ts`. Add cache tags as needed in `store/sdk.ts`. Follow the `generate-sdk` skill.
  - Files: `example-frontend/store/openApiSdk.ts` (generated), `example-frontend/store/sdk.ts`
  - Depends on: 5.1
  - Acceptance: Generated SDK builds; consent-link endpoints present; never hand-edit `openApiSdk.ts`.

- [ ] **Task 5.5**: Docs + rulesync
  - Description: Add a how-to (e.g. `docs/how-to/`) describing signed consent links (generation, security model, expiry/revocation, public flow). Update consent-related docs/reference if needed and run rulesync per the `update-docs` skill.
  - Files: `docs/how-to/*.md`, generated reference as applicable
  - Depends on: Phases 1-4
  - Acceptance: Docs build; new feature documented; rulesync clean.
