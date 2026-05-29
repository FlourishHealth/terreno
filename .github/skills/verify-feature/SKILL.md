---
name: verify-feature
description: >-
  Prove a feature works locally with screenshots and video — web
  (Chrome/Playwright), native (Maestro), or iOS simulator (EAS dev client).
  Attach evidence to the PR.
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
| Native (Maestro) | Maestro on web export | `bun run proof:native [flow]` |
| iOS simulator | EAS dev client + PR channel | `bun run proof:sim [app] [pr#]` |
| Full stack | Backend + frontend | `bun run stack:dev` |

**Prefer web first** — it starts in seconds. Use the iOS simulator path when the change is native-only or you need to validate the EAS dev-client + update channel flow.

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
# Single flow
bun run proof:web login
bun run proof:web todos

# Custom spec
bun run proof:web e2e/consents.spec.ts

# Full suite
bun run proof:web
```

Output lands in `.proof/pr-<number>/web-<timestamp>/` with:
- `report/index.html` — interactive report with embedded video
- `test-results/` — per-test screenshots and `.webm` video

Open the report locally and **show key screenshots in the agent session** (Devin-style).

### Web — browser-harness (manual exploration)

When Playwright doesn't cover the flow yet:

```bash
browser-harness <<'PY'
new_tab("http://localhost:8082/login")
wait_for_load()
capture_screenshot()
PY
```

Use `capture_screenshot()` after each meaningful action. Read the image files back into the conversation for the user.

### Native — Maestro

```bash
bun run proof:native login
bun run proof:native create-todo
```

Debug output (screenshots, logs): `.proof/pr-<number>/native-<timestamp>/`

### iOS simulator — latest EAS dev build (macOS only)

PRs get EAS Update branches (`pr-<number>`) and install links via the EAS PR comment. Locally:

```bash
# Uses latest finished development:simulator build + PR update channel
bun run proof:sim example-frontend
```

Record the simulator with QuickTime / `xcrun simctl io booted recordVideo proof.mp4` while exercising the feature.

On PRs, prefer the **existing dev build** from the EAS PR comment (fast path) instead of rebuilding — only fingerprint changes trigger new native builds.

## Step 3: Attach to PR

After capture, post a proof summary comment:

```bash
bun run proof:attach --summary "Logged in, created todo, verified realtime sync"
```

Optionally pass a specific directory:

```bash
bun run proof:attach --dir .proof/pr-42/web-20260529-120000 --summary "..."
```

Also update the PR body's **Feature Proof** section (see `/submit` template) with:
- Platform used (web / iOS sim / Android)
- Steps exercised
- Link or path to HTML report
- Embedded screenshots in the PR comment thread when possible

## Step 4: Update PR template sections

Ensure the PR includes:

```markdown
## Feature Proof
- **Platform:** Web (Chrome via Playwright)
- **Steps:** [what you did]
- **Result:** [pass/fail + notes]
- **Artifacts:** `.proof/pr-N/...` (report + video)

## Human Testing Steps
- [ ] ...
```

## Writing new proof flows

When no existing Playwright spec covers the feature:

1. Add or extend a spec in `example-frontend/e2e/`
2. Use `testID` props on new UI elements
3. Run `bun run proof:web <spec>` to capture video
4. For Maestro, add `.maestro/flows/<name>.yaml`

## CI parity

| Local | CI |
|-------|-----|
| `bun run proof:web` | `.github/workflows/e2e-ci.yml` (Playwright matrix) |
| `bun run maestro:test` | `.github/workflows/maestro-e2e.yml` |
| EAS dev build + update | `.github/workflows/eas-pr.yml` |

Local proof should exercise the same happy path CI covers, plus any new behavior not yet in e2e specs.

## Arguments

$FLOW: Optional flow/spec name for `proof:web` or `proof:native`
$SUMMARY: One-line description for `proof:attach`
