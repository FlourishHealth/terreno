# Update dependencies

Use the `update-dependencies` skill (`/update-dependencies`) instead of merging a Dependabot PR that you have not proven.

```bash
# From latest master, clean tree
bun outdated
```

Then follow the skill: one package per PR, an **exercise test** that imports that package, and **unchanged** Expo fingerprints for `example-frontend` and `demo`.

Why this shape: [Dependency management](../explanation/dependency-management.md). Native Expo/React Native bumps wait for a release (`upgrading-expo`).

## Do now

1. Inventory with `bun outdated`. Skip anything `isFingerprintSkip` in `scripts/planning/fingerprintRisk.ts` (`expo`, `expo-*`, `react-native`, most `react-native-*`, native community modules).
2. Confirm a test file imports the package. If none exists, add a tracer test that imports the real module, then bump.
3. Change the root `catalog` pin when the package is shared; keep workspace `"catalog:"`. Run `bun install`.
4. Re-run that exercise test. Recompute iOS and Android fingerprints for `example-frontend` and `demo`. Revert if a hash moved.
5. Open one PR whose body names the exercise test command and the four unchanged hashes.

## Guardrails

| Rule | Action |
| --- | --- |
| Fingerprint would change | Revert. Defer to a release. Never add `fingerprint-acknowledged` to land it. |
| No test imports the package | Write the tracer test first. Do not bump on `test:ci` alone. |
| Published < 7 days ago (non-CVE) | Wait. Compromised npm packages are often yanked quickly. |
| Major version | Allowed only if fingerprints match and the exercise test passes. Do not auto-merge. |
| Dependabot grouped catalog PR | Do not merge if it includes a skip-list package. Redo with this how-to. |

## Fingerprints

`example-frontend` and `demo` use `fingerprint.config.js`. Hash with `eas fingerprint:generate` when `EXPO_TOKEN` is set, otherwise `bunx @expo/fingerprint <app-dir>`. Compare against a baseline taken **before** `bun install`.

`eas.json` Bun pins feed the fingerprint. Do not bump them here.

## Dependabot still runs

GitHub Dependabot remains configured in `.github/dependabot.yml` (weekly Actions, monthly bun groups, 7-day cooldown). Root catalog ignores native/Expo packages so auto-merge cannot land a fingerprint change. Treat Dependabot as a signal; land updates through this guide.
