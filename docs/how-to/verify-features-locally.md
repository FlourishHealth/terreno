# Verify features locally (screenshots & video)

Prove user-visible changes work before opening or updating a PR. This mirrors Devin-style verification: run the app, exercise the feature, and attach screenshots or video as evidence.

## Quick start

No local MongoDB install required — `stack:dev`, `proof:web`, and `sdk:generate` always start **in-memory MongoDB** (`mongodb-memory-server`).

```bash
bun run appium:setup          # once — install Appium drivers
bun run stack:dev             # memory Mongo + backend :4000 + frontend :8082 (seeded)
bun run proof:appium login    # Appium capture → .proof/pr-N/
bun run proof:attach --summary "Login flow verified"
```

SDK regeneration uses the same memory Mongo stack:

```bash
bun run sdk:generate          # memory Mongo + backend + codegen + cleanup
```

Or use Playwright for HTML reports with embedded video:

```bash
bun run proof:web login
```

## Platform guide

### Web — Playwright (recommended for video reports)

```bash
bun run proof:web todos
cd example-frontend && bun run test:e2e
```

### Web / simulator — Appium + WebdriverIO

Appium specs in `appium/specs/` run against Chrome (web) or the iOS simulator (native):

```bash
bun run appium:setup
bun run proof:appium create-todo
bun run appium:test
```

Set `APPIUM_PLATFORM=ios` after launching the dev client with `bun run proof:sim`.

### iOS simulator + EAS dev client (macOS)

```bash
bun run proof:sim example-frontend
xcrun simctl io booted recordVideo .proof/demo.webm
```

## PR evidence checklist

1. Run the stack and capture proof (`proof:web`, `proof:appium`, or simulator recording)
2. Show key screenshots in the agent session
3. Run `bun run proof:attach`
4. Fill in the **Feature Proof** section in the PR body

Test user: `test@example.com` / `testpassword123`

## Scripts reference

| Script | Purpose |
|--------|---------|
| `scripts/feature-proof/setup-appium.sh` | Install Appium Chromium/XCUITest drivers |
| `scripts/feature-proof/start-stack.sh` | Start backend + frontend |
| `scripts/feature-proof/capture-web.sh` | Playwright proof capture |
| `scripts/feature-proof/capture-native.sh` | Appium proof capture (`proof:appium`) |
| `scripts/feature-proof/launch-ios-sim.sh` | EAS dev client on simulator |
| `scripts/feature-proof/attach-pr-proof.sh` | Post proof summary to PR |

Root shortcuts: `stack:dev`, `proof:web`, `proof:appium`, `proof:native` (alias), `proof:sim`, `appium:test`, `appium:setup`

## CI workflows

- **E2E (Playwright):** `e2e-ci.yml`
- **Appium:** `appium-e2e.yml` — manual dispatch, uploads screenshots
- **EAS PR builds:** `eas-pr.yml`

## Agent skill

Invoke `/verify-feature` before `/submit` on user-visible changes. See `.rulesync/skills/verify-feature/SKILL.md`.
