---
name: verify-feature
description: Prove a feature works locally with screenshots and video — web (Chrome/Playwright), Appium (Chrome web or iOS simulator), or EAS dev client. Attach evidence to the PR.
---
# Verify Feature (Devin-style proof)

Before `/submit`, prove user-visible changes work and capture evidence reviewers can trust. Automated unit tests are necessary but not sufficient — show the feature running.

## When to run

Run when the PR touches:
- `ui/`, `example-frontend/`, `demo/`, `admin-frontend/`
- Backend routes consumed by the example app
- Anything with a **Human Testing Steps** section in the PR

Skip for pure refactors, docs-only, or backend-only changes with no UI surface.

## Choose a platform

| Surface | Tool | Command |
|---------|------|---------|
| Web (fastest) | Playwright + Chrome | `bun run proof:web [flow]` |
| Web (interactive) | browser-harness | Connect to Chrome at `http://localhost:8082` |
| Appium (web) | Appium + Chrome via WebdriverIO | `bun run proof:appium [flow]` |
| iOS simulator | Appium + EAS dev client | `APPIUM_PLATFORM=ios bun run proof:appium [flow]` |
| iOS simulator (manual) | EAS dev client + PR channel | `bun run proof:sim [app] [pr#]` |
| Full stack | Backend + frontend | `bun run stack:dev` |

**Prefer web first** — Playwright or Appium-on-Chrome start in seconds. Use the iOS simulator path when the change is native-only or you need to validate the EAS dev-client + update channel flow.

First-time setup: `bun run appium:setup` (installs Chromium + XCUITest drivers to `~/.appium-terreno`).

## Step 1: Start the stack

```bash
bun run stack:dev
```

This starts example-backend (`:4000`) and example-frontend web (`:8082`) with seeded test users.

Test credentials: `test@example.com` / `testpassword123`

Stop when done: `bun run stack:stop`

## Step 2: Capture proof

### Web — Playwright (screenshots + video + HTML report)

```bash
bun run proof:web login
bun run proof:web e2e/todos.spec.ts
bun run proof:web
```

Output lands in `.proof/pr-<number>/web-<timestamp>/`.

### Appium + WebdriverIO (screenshots per step)

```bash
bun run proof:appium login
bun run proof:appium create-todo
bun run appium:test
```

Specs live in `appium/specs/`. Proof output: `.proof/pr-<number>/appium-<timestamp>/`

For iOS simulator with dev client installed:

```bash
bun run proof:sim example-frontend
APPIUM_PLATFORM=ios bun run proof:appium login
```

### Web — browser-harness (manual exploration)

```bash
browser-harness <<'PY'
new_tab("http://localhost:8082/login")
wait_for_load()
capture_screenshot()
PY
```

## Step 3: Attach to PR

```bash
bun run proof:attach --summary "Logged in, created todo, verified realtime sync"
```

## Step 4: Update PR template sections

```markdown
## Feature Proof
- **Platform:** Web (Chrome via Playwright / Appium)
- **Steps:** [what you did]
- **Result:** [pass/fail + notes]
- **Artifacts:** `.proof/pr-N/...`

## Human Testing Steps
- [ ] ...
```

## Writing new proof flows

1. Add Playwright specs in `example-frontend/e2e/` for CI parity
2. Add matching Appium specs in `appium/specs/` using `data-testid` selectors
3. Use `testID` props on new UI elements

## CI parity

| Local | CI |
|-------|-----|
| `bun run proof:web` | `.github/workflows/e2e-ci.yml` (Playwright) |
| `bun run appium:test` | `.github/workflows/appium-e2e.yml` |
| EAS dev build + update | `.github/workflows/eas-pr.yml` |

## Arguments

$FLOW: Optional flow name for `proof:web` or `proof:appium` (login, signup, create-todo)
$SUMMARY: One-line description for `proof:attach`
