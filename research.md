# Research: OpenFeature Adoption for `@terreno/feature-flags`

## Summary

Adopt OpenFeature by **building a custom OpenFeature provider that wraps our existing Mongoose-backed evaluation logic**, with no data migration and a thin BC wrapper preserving the current `useFeatureFlags` hook. The backend keeps Mongo as the source of truth and uses OpenFeature's Node SDK on the eval path; the frontend uses OpenFeature React SDK with an `InMemoryProvider` seeded from a single bulk fetch. Net result: vendor portability without giving up our admin UI, our targeting model, or our deterministic-hash rollout.

## Context

The terreno monorepo ships feature flags as `@terreno/feature-flags` (backend plugin) + `useFeatureFlags()` hook in `@terreno/rtk` (frontend). Today's pattern is **server-evaluates-all, client-bulk-fetches-once**:

- Backend: `FeatureFlagsApp` registers admin CRUD via `modelRouter` + a single `GET /feature-flags/evaluate` endpoint. Evaluator (`feature-flags/src/evaluate.ts`) reads `enabled && !archived` flags, walks rules (field operators + named segment functions), falls back to deterministic djb2 hash on `userId:flagKey` against `rolloutPercentage` (boolean) or cumulative variant weights (string variant).
- Frontend: `useFeatureFlags(api)` injects an RTK Query endpoint, calls `/evaluate`, exposes `getFlag()` (bool) and `getVariant()` (string|null). Used in `example-frontend/app/(tabs)/index.tsx:105` and `profile.tsx:27-40`.
- Storage: `FeatureFlag` Mongoose collection with `key, name, enabled, type ("boolean"|"variant"), variants[], rules[], rolloutPercentage, archived`. Admin UI auto-generated via `@terreno/admin-backend` from `featureFlagAdminConfig`.

User answered the four shaping questions:
1. **Motivation**: vendor flexibility — portable SDK surface, can swap providers later.
2. **Topology**: server-eval, bulk fetch (keep current network shape).
3. **BC**: `useFeatureFlags` stays as a thin wrapper over OpenFeature hooks.
4. **Storage**: keep Mongo, extend schema if needed (no destructive changes).

## OpenFeature Findings

### Two SDKs, two provider shapes

| SDK | Where | Provider methods | Notes |
|---|---|---|---|
| `@openfeature/server-sdk` | Node (our `feature-flags/src/...`) | `resolveBooleanEvaluation(key, default, ctx)` etc, **async** | Receives `EvaluationContext` per call. Has `AsyncLocalStorageTransactionContextPropagator` for Express middleware. |
| `@openfeature/react-sdk` (built on `@openfeature/web-sdk`) | Frontend (our `useFeatureFlags`) | `resolveBooleanEvaluation(key, default)` etc, **sync** | Context is **static** on the provider; `onContextChange(old, new)` is fired when `OpenFeature.setContext({...})` is called. |

### ResolutionDetails (what every resolve method returns)

```typescript
{
  value: T;                       // resolved value
  variant?: string;               // e.g. "on" / "off" / "variant-a"
  reason?: "STATIC" | "DEFAULT" | "TARGETING_MATCH" | "SPLIT" | "DISABLED" | "ERROR" | ...;
  errorCode?: ErrorCode;          // e.g. INVALID_CONTEXT, PROVIDER_FATAL
  errorMessage?: string;
  flagMetadata?: Record<string, string | number | boolean>;
}
```

### InMemoryProvider (built into both SDKs) is exactly what we want on the frontend

`TypedInMemoryProvider` accepts a `FlagConfiguration` map:

```typescript
import { TypedInMemoryProvider } from '@openfeature/web-sdk';
const flags = {
  "todo-summary-card": {
    variants: { on: true, off: false },
    disabled: false,
    defaultVariant: "on",
  },
  "profile-layout": {
    variants: { compact: "compact", detailed: "detailed" },
    disabled: false,
    defaultVariant: "compact",
  },
} as const;
OpenFeature.setProvider(new TypedInMemoryProvider(flags));
```

**This is the linchpin**: the backend can return a pre-resolved `FlagConfiguration` for the current user, and the frontend feeds it straight into `OpenFeature.setProvider(new InMemoryProvider(...))`. No per-flag round trips, no client-side evaluation logic.

### React SDK hooks

- `useFlag(key, defaultValue)` — primary, infers type from default
- `useBooleanFlagValue(key, defaultValue)` / `...Details(...)` (returns `{value, variant, reason}`)
- `useStringFlagValue` / `useNumberFlagValue` / `useObjectFlagValue`
- `useSuspenseFlag(key, defaultValue)` — Suspense integration
- `<FeatureFlag flagKey="..." defaultValue={false}>...</FeatureFlag>` — declarative
- `OpenFeatureProvider` (context) and `OpenFeatureTestProvider` (testing)

### Type-safe flag keys (`@openfeature/core`)

Module augmentation lets us narrow `BooleanFlagKey` / `StringFlagKey` to literal unions. Worth wiring up so typos on `getFlag("typo-key")` fail at the type level.

### `targetingKey` is the standard user identifier

OpenFeature's evaluation context has a privileged field `targetingKey` (string) that providers use for bucketing / sticky assignment. We currently use `String(user._id ?? user.id)` for the hash; we map this directly to `targetingKey`.

## How current concepts map to OpenFeature

| Today | OpenFeature equivalent | Notes |
|---|---|---|
| `flag.key` | flag key | identical |
| `flag.type: "boolean"` + result `true`/`false` | boolean flag | use `resolveBooleanEvaluation` |
| `flag.type: "variant"` + result `string\|null` | string flag | use `resolveStringEvaluation`; **change `null` → a `defaultVariant` string**, since OF doesn't have null variants. Storing a `defaultVariant` field on the flag doc gives us a clean "disabled" return value. |
| `flag.enabled: false` | `reason: "DISABLED"`, return `defaultValue` | provider returns default when disabled; reason flag downstream consumers can read via `*FlagDetails` |
| `rules[]` (field operator / segment) | targeting logic in provider | unchanged; lives in our provider impl, not in OF |
| `rolloutPercentage` + deterministic hash | targeting logic in provider | unchanged; `reason: "SPLIT"` |
| `segments` registry | targeting logic in provider | unchanged; passed in at provider construction (same as `FeatureFlagsApp` options today) |
| `userId` for hashing | `EvaluationContext.targetingKey` | one-line change |
| `user` object for rule field-matching | `EvaluationContext` (any keys) | flatten user attrs into context, or pass `user` as a nested attr |

**Naming concern**: OF's "variant" is the *name of a value within a flag* (e.g. `"on"` for boolean true). Our "variant" today is the same name but maps to a string value. There's a small terminology overload — a boolean flag in OF has variants `{on: true, off: false}`. We need to construct that when emitting `FlagConfiguration` from a boolean flag doc.

## Architecture for the migration

```
                          BACKEND (@terreno/feature-flags)
   ┌──────────────────────────────────────────────────────────┐
   │  MongoFeatureFlagProvider implements Provider             │
   │  - constructor({segments, flagModel})                     │
   │  - readonly runsOn = "server"                             │
   │  - resolveBooleanEvaluation(key, default, ctx)            │
   │  - resolveStringEvaluation(key, default, ctx)             │
   │     → reuses our existing evaluateFlag(...) logic         │
   │     → reads ctx.targetingKey for hashing                  │
   │     → reads ctx.user (or flat attrs) for rule matching    │
   └──────────────────────────────────────────────────────────┘
                                │
                       OpenFeature Node SDK
                                │
   ┌──────────────────────────────────────────────────────────┐
   │  FeatureFlagsApp.register() now:                          │
   │  - OpenFeature.setProvider(new MongoFeatureFlagProvider) │
   │  - keeps modelRouter for admin CRUD                       │
   │  - GET /feature-flags/evaluate                            │
   │     → loads all enabled flag docs                         │
   │     → for each, calls client.getBooleanDetails or         │
   │       client.getStringDetails with user-derived ctx       │
   │     → returns OF-shape FlagConfiguration JSON            │
   └──────────────────────────────────────────────────────────┘
                                │
                         HTTP /evaluate
                                │
                          FRONTEND (@terreno/rtk)
   ┌──────────────────────────────────────────────────────────┐
   │  useTerrenoFeatureFlags(api):                             │
   │  - RTK Query bulk fetch /feature-flags/evaluate           │
   │  - on success: OpenFeature.setProvider(                   │
   │      new TypedInMemoryProvider(response.flags))           │
   │  - on user change: OpenFeature.setContext({               │
   │      targetingKey: userId, ...attrs})                     │
   └──────────────────────────────────────────────────────────┘
                                │
                          User code:
   ┌──────────────────────────────────────────────────────────┐
   │  const enabled = useBooleanFlagValue("todo-summary",      │
   │                                       false);             │
   │  // OR via thin BC wrapper:                               │
   │  const {getFlag} = useFeatureFlags(api);                  │
   │  const enabled = getFlag("todo-summary");                 │
   └──────────────────────────────────────────────────────────┘
```

The frontend doesn't actually need a custom provider — `InMemoryProvider` is OpenFeature's reference impl and is the right tool for "server already evaluated, just expose values via OF hooks." We **do** need a custom provider on the server (where targeting actually happens).

## Schema extensions needed

Current `FeatureFlag` model is *almost* sufficient. Minimal additions:

| Field | Type | Purpose | Default |
|---|---|---|---|
| `defaultVariant` | String | OF requires a `defaultVariant` per flag in `InMemoryProvider`. For boolean flags this is `"on"` or `"off"`. For variant flags, this is the variant key returned when disabled (replaces today's `null`). | computed: `"off"` for boolean, first variant key for variant flags |

Everything else maps cleanly. The Mongoose schema stays backwards-compatible (existing docs without `defaultVariant` work via a getter that computes it). No migration; old docs just get the computed default at read time.

## Wire protocol change

Today's `/evaluate` returns:
```json
{"data": {"todo-summary-card": true, "profile-layout": "compact"}}
```

New `/evaluate` returns an OF `FlagConfiguration`:
```json
{
  "data": {
    "todo-summary-card": {
      "variants": {"on": true, "off": false},
      "disabled": false,
      "defaultVariant": "on"
    },
    "profile-layout": {
      "variants": {"compact": "compact", "detailed": "detailed"},
      "disabled": false,
      "defaultVariant": "compact"
    }
  }
}
```

The OF `disabled` field per flag is **per-user-resolved** disabled — we set `disabled: true` when the flag would not evaluate for this user. Combined with `defaultVariant`, the consumer can use OF hooks normally and get the right value either way.

The bulk fetch is still one network round trip. Payload is ~3× larger per flag, but flag counts are O(10s) so it's a non-issue.

## Options Considered

| Option | Approach | Pros | Cons | Effort |
|---|---|---|---|---|
| **A. Custom provider + InMemoryProvider on FE (recommended)** | Server-eval via our provider, FE consumes pre-resolved via InMemoryProvider | Vendor-portable, no client-side evaluation logic, single fetch, no data migration | Wire protocol changes (1 endpoint) | M |
| B. Custom HTTP provider on FE | FE provider hits `/evaluate-one/{key}` per flag, server evaluates per request | Truly OF-native client API, supports context changes seamlessly | Many round trips OR needs aggressive batching middleware; bigger break from current pattern | L |
| C. Replace backend with flagd | Drop our package, run flagd sidecar, FE uses flagd-web-provider | Standard, off-the-shelf | Loses admin UI, loses Mongo storage, big infra change, breaks "no data migration" rule | XL |
| D. Adopt OF SDK without custom provider | Server keeps current endpoint; FE wraps results in fake `useFlag` API that doesn't use OF underneath | Smallest code change | Doesn't actually adopt OF — defeats purpose | S |

## Recommendation

**Go with Option A.** Specifically:

1. Add `@openfeature/server-sdk` to `feature-flags/` deps. Create `MongoFeatureFlagProvider` in `feature-flags/src/openFeatureProvider.ts` that delegates to existing `evaluateFlag()` logic. Existing `evaluate.ts` stays — provider is a thin OF-shaped wrapper around it.
2. `FeatureFlagsApp.register()` calls `OpenFeature.setProvider(...)` once at startup. The `/evaluate` endpoint switches from raw values to OF `FlagConfiguration` shape (per-user resolved `disabled` + `defaultVariant`).
3. Add `defaultVariant` field to `FeatureFlag` schema with a getter that auto-computes for legacy docs. No migration required.
4. Add `@openfeature/react-sdk` + `@openfeature/web-sdk` to `rtk/` deps. Create new `useTerrenoFeatureFlags(api)` hook that wraps `OpenFeature.setProvider(new InMemoryProvider(...))` around the RTK Query bulk fetch. Rewrite existing `useFeatureFlags(api)` to call the new hook and expose the same `getFlag` / `getVariant` API for BC.
5. Update `example-frontend/app/_layout.tsx` to wrap the app in `<OpenFeatureProvider>` (a one-line addition).
6. Update tests: keep existing `evaluate.test.ts` and `featureFlagsApp.test.ts` semantics, add new `openFeatureProvider.test.ts`. Frontend hook test adapts to the new payload shape.

This preserves: admin UI, Mongo storage, segment functions, rule operators, deterministic hashing, BC. Gives us: OF hooks, declarative `<FeatureFlag>`, eventing for live updates later, type-safe flag keys, and future portability to flagd/GrowthBook/etc by swapping the server provider.

## Open Questions

1. **Should we also expose `useBooleanFlagValue` etc directly from `@terreno/rtk`?** They're already exported from `@openfeature/react-sdk`; consumers can import from there. But re-exporting from `@terreno/rtk` would make discovery easier. → Tentatively yes, re-export for ergonomics; not load-bearing.
2. **Eventing / live updates.** OpenFeature supports `PROVIDER_CONFIGURATION_CHANGED`. We could wire it to a Mongoose change stream so admin edits push to connected clients via socket. **Out of scope for v1** — keep refetch behavior.
3. **Anonymous evaluation.** `/evaluate` is `IsAuthenticated` today. Should the new endpoint allow anonymous (with anonymous targetingKey)? **Out of scope** — same behavior as today.
4. **Should we keep `getVariant` returning `null`?** OF doesn't naturally return null. We can synthesize: if `reason === "DISABLED"` in the resolved details, the BC wrapper returns `null` from `getVariant`. Preserves existing consumer expectations.
5. **Provider domains.** OF supports multiple providers via domains (`OpenFeature.setProvider("billing", ...)`). Worth exposing in `FeatureFlagsApp` constructor? **Not for v1** — single default provider is enough.

## References

- Today's package: `feature-flags/src/featureFlagsApp.ts`, `feature-flags/src/evaluate.ts`, `feature-flags/src/featureFlagModel.ts`, `feature-flags/src/types.ts`
- Today's hook: `rtk/src/useFeatureFlags.ts`
- Today's docs: `docs/reference/feature-flags.md`, `docs/how-to/add-feature-flags.md`, `docs/implementationPlans/feature-flags.md`
- OpenFeature concept: https://openfeature.dev/docs/reference/concepts/provider
- OpenFeature spec (providers): https://openfeature.dev/specification/sections/providers
- Server SDK: https://github.com/open-feature/js-sdk (packages/server)
- React SDK: https://github.com/open-feature/js-sdk (packages/react)
- InMemoryProvider example from server README: `TypedInMemoryProvider({key: {variants, disabled, defaultVariant}})`
