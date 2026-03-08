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
