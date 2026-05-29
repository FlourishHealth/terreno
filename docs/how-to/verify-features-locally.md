# Verify features locally (screenshots & video)

Prove user-visible changes work before opening or updating a PR. This mirrors Devin-style verification: run the app, exercise the feature, and attach screenshots or video as evidence.

## Quick start

```bash
bun run stack:dev              # backend :4000 + frontend :8082 (seeded)
bun run proof:web login        # Playwright capture → .proof/pr-N/
bun run proof:attach --summary "Login flow verified"
```

Open the HTML report path printed by `proof:web` — it includes embedded video for each test.

## Platform guide

### Web (recommended default)

Fastest feedback loop. Uses Playwright with `playwright.proof.config.ts` (always records video + screenshots).

```bash
bun run proof:web todos           # single flow
bun run proof:web                 # full e2e suite
cd example-frontend && bun run test:e2e   # standard e2e (no proof artifacts)
```

For exploratory testing, use **browser-harness** against `http://localhost:8082` and call `capture_screenshot()` after each step.

### iOS simulator + EAS dev client (macOS)

Use when validating native behavior or the PR's EAS Update channel:

```bash
bun run proof:sim example-frontend
```

This installs the latest finished `development:simulator` build from EAS (same builds linked in PR comments) and starts Metro on the `pr-<number>` update branch when a PR is open.

Record video while testing:

```bash
xcrun simctl io booted recordVideo .proof/demo.webm
# ... exercise feature ...
# Ctrl+C to stop recording
```

### Maestro (web target)

Maestro flows in `.maestro/flows/` run against the web export served on `:8082`:

```bash
bun run proof:native create-todo
```

## PR evidence checklist

Before `/submit` on UI-facing work:

1. Run the stack and capture proof (`proof:web`, `proof:native`, or simulator recording)
2. Show key screenshots in the agent session
3. Run `bun run proof:attach` to post a PR comment
4. Fill in the **Feature Proof** section in the PR body

Test user: `test@example.com` / `testpassword123`

## Scripts reference

| Script | Purpose |
|--------|---------|
| `scripts/feature-proof/start-stack.sh` | Start backend + frontend |
| `scripts/feature-proof/capture-web.sh` | Playwright proof capture |
| `scripts/feature-proof/capture-native.sh` | Maestro with debug output |
| `scripts/feature-proof/launch-ios-sim.sh` | EAS dev client on simulator |
| `scripts/feature-proof/attach-pr-proof.sh` | Post proof summary to PR |
| `scripts/feature-proof/wait-for-review-gate.sh` | Wait for Bugbot/Copilot checks |

Root shortcuts: `stack:dev`, `stack:stop`, `proof:web`, `proof:native`, `proof:sim`, `proof:attach`

## CI workflows

- **E2E (Playwright):** `e2e-ci.yml` — matrix per spec, uploads HTML reports as artifacts
- **Maestro:** `maestro-e2e.yml` — manual dispatch, uploads screenshots
- **EAS PR builds:** `eas-pr.yml` — fingerprint-gated dev builds + OTA updates on `pr-<number>`

Local proof complements CI; it does not replace automated tests.

## Agent skill

Agents should invoke `/verify-feature` before `/submit` when the change is user-visible. See `.rulesync/skills/verify-feature/SKILL.md`.
