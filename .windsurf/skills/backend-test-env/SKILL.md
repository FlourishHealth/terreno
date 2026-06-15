---
name: backend-test-env
description: >-
  How to safely mutate `process.env` in backend tests (`@terreno/api`,
  `@terreno/ai`, example-backend) — the preload contract and
  `setupEnvironment()`.
---
# Backend Test — `process.env` Contract

Bun's test runner preloads a per-package setup file (configured in each package's `bunfig.toml` under `[test].preload`):

| Package | Preload file |
|---------|--------------|
| `@terreno/api` | `api/src/tests/bunSetup.ts` |
| `@terreno/ai` | `ai/src/tests/bunSetup.ts` |
| `example-backend` | `example-backend/src/tests/setup.ts` |

The `@terreno/api` preload uses a global `beforeEach` to (1) reset the canonical auth secrets, (2) call `setupEnvironment()` (exported from `expressServer.ts`) for the wider baseline, and (3) re-silence the winston loggers. The next test always starts from the canonical baseline — you normally **do not** need to re-call `setupEnvironment()` in a file-level `beforeEach`.

## Default — Rely on the Preload

- Do not assume a toggle left by another file. Treat the preload's `beforeEach` as the source of truth for the canonical baseline.
- Set only the keys this test needs in its own `beforeEach` or test body.
- Don't reach in and call `setupEnvironment()` again unless you're explicitly testing env-driven behavior that the preload didn't cover.

## When a Test Mutates `process.env`

1. **Add the key to the preload's reset list** if it should always start from a fixed test value. Otherwise it leaks into the next test in the same worker.
2. **Set only what this case needs** in the test body — avoid redundant manual restore if the preload already resets that key in `beforeEach`.
3. **For keys that should be absent (unset)**, use **`Reflect.deleteProperty(process.env, "KEY")`**. Avoid `process.env.KEY = ""` to mean "unset" — on some platforms empty string and unset behave differently and can make tests flaky.
4. **Avoid whole-env snapshots** (`const OLD_ENV = process.env; ...; process.env = OLD_ENV;`). This pattern exists in some older test files (`auth.test.ts`) — don't propagate it. It captures pre-`beforeEach` state and breaks ordering guarantees if the preload's `beforeEach` runs in between. Use targeted mutations + the preload's reset instead.

## Adding a New Required Env Var

If you introduce a new `process.env.FOO` that backend code reads at startup:

1. Add `FOO` to `setupEnvironment()` in `api/src/expressServer.ts` so every package picks it up via the preload's `setupEnvironment()` call.
2. If `example-backend` has its own startup needs for it, also add to `example-backend/src/tests/setup.ts`'s `beforeAll`.
3. If a test needs to mutate it, follow the rules above — don't snapshot the whole env.

## Auth-Related Keys

`api/src/tests/bunSetup.ts` resets four auth keys in `beforeEach`: `TOKEN_SECRET`, `TOKEN_ISSUER`, `SESSION_SECRET`, `REFRESH_TOKEN_SECRET`. If your test changes any of these, you do not need to restore — the next `beforeEach` already does. If your test relies on them being **absent** for a code path, use `Reflect.deleteProperty` within the test, knowing the next `beforeEach` will restore.

`auth.test.ts` is the established home for env-driven auth assertions; mirror its newer patterns (per-test `beforeEach` setting only what changes) rather than its older whole-env-snapshot blocks.

## Log Capture & Sentry

The preload silences winston and `console.*` and captures into an in-memory buffer (cleared in `beforeEach`/`afterEach`). It also mocks `@sentry/bun`. Don't re-mock Sentry inside individual tests — the preload's mock is shared and reset across tests.

## Checklist

- [ ] New env var added to `setupEnvironment()` and (if needed) `example-backend/src/tests/setup.ts`
- [ ] Test mutations are targeted — no whole-env snapshots
- [ ] "Unset" expressed as `Reflect.deleteProperty(process.env, "KEY")`, not `= ""`
- [ ] No manual restore that duplicates the preload's `beforeEach` reset
- [ ] No re-mock of `@sentry/bun` — the preload's mock is already in place
- [ ] If you added an env-driven branch in code, a test covers both the set and the unset case
