# Dependency Management

Terreno pins shared versions in the Bun catalog, lands JavaScript updates through
an agent skill that proves each bump with a test, and keeps Expo native
fingerprints frozen until a release.

## Layers

| Layer | Job |
| --- | --- |
| **Bun catalog** | One version for every dependency shared by two or more workspace packages (`catalog:` in manifests) |
| **`update-dependencies` skill** | Daily rolling PR on `chore/update-dependencies`: cooldown, exercise test, fingerprint freeze, ledger of landed/failed |
| **Dependabot** | Backup signal for bun + GitHub Actions. Native/Expo catalog names are ignored so auto-merge cannot change the fingerprint |
| **Release + `upgrading-expo`** | Expo SDK, React Native, and other native-module bumps |

Operator steps: [Update dependencies](../how-to/update-dependencies.md). Catalog rule: workspace `package.json` files use `"catalog:"` for shared pins.

## Bun catalogs

Shared versions live in the root `package.json` `catalog` field.

```json
{
  "catalog": {
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

```json
{
  "dependencies": {
    "react": "catalog:",
    "react-native": "catalog:"
  }
}
```

Change a shared version in the catalog once. Do not pin a second copy in a workspace package. Exceptions (`@types/node`, `path-to-regexp`, `@opentelemetry/sdk-node`) are listed in `.rulesync/rules/01-dependency-catalog.md`.

## Agent updates vs Dependabot

Dependabot groups many packages and merges when CI is green. That misses two Terreno constraints:

1. **Exercise.** CI can pass without any test importing the bumped module. The skill requires a named test file that imports the package and that passed **after** the bump. If none exists, write a tracer-bullet test first.
2. **Fingerprint.** Expo `runtimeVersion.policy: "fingerprint"` ties OTA runtime and EAS dev builds to native hashes of `example-frontend` and `demo`. Native module bumps belong in a release, not a weekday dependency PR.

`scripts/planning/fingerprintRisk.ts` (`isFingerprintSkip`) is the skip matcher. After every allowed bump the skill still recomputes hashes; a changed hash is reverted even if the matcher allowed the name.

## Cooldown

Non-security npm versions wait **7 days** after publish before a bump (`npm view <name> time`). Most malicious publishes are yanked inside a day. GitHub Dependabot uses the same `cooldown.default-days: 7`. CVE/advisory bumps skip the wait and still need an exercise test and a fingerprint freeze.

## Fingerprint freeze

Do not bump from this path:

- `expo`, `expo-*`, `react-native`, `react-native-*` except `react-native-web`
- `@react-native/*` and related community native modules
- `@expo/config-plugins`, `@sentry/react-native`, `@shopify/flash-list`, `@shopify/react-native-skia`
- `eas.json` Bun version (it is a fingerprint input)

Those wait for a Terreno release (`release` + `upgrading-expo` skills). Do not use the `fingerprint-acknowledged` label to sneak them through a dependency PR.

JavaScript packages, GitHub Actions, and a few Expo JS-only names may update. Measure hashes for both apps anyway.

## Dependabot configuration

`.github/dependabot.yml` still opens grouped PRs:

| Group | Ecosystem | Schedule |
| --- | --- | --- |
| GitHub Actions | `github-actions` at `/` | Weekly |
| Root catalog and root tools | `bun` at `/` | Monthly |
| Backend workspaces | `bun` under api, ai, backends, … | Monthly |
| Frontend workspaces | `bun` under ui, rtk, demo, apps, … | Monthly |

Frontend ignores catalog-managed names so those PRs do not duplicate the root catalog. Root ignores fingerprint-skip names. `dependabot-auto-merge.yml` still squash-merges Dependabot PRs when required checks pass. Do not merge a Dependabot PR that includes a skip-list package; redo it with [Update dependencies](../how-to/update-dependencies.md).

## Daily rolling PR

The skill runs every day against **one trusted** open PR: exact same-repository head `chore/update-dependencies`, base `master`, and `isCrossRepository: false`. The marker `<!-- terreno-update-dependencies -->` and title are display metadata, not trust signals. Forks that copy them are ignored.

A later run merges current master into that branch without rewriting history, retries **Failed** rows, appends **Landed** / **Failed** / **Skipped**, and pushes to the same head. It does not open a second trusted PR while that one is open. After merge, the next day may open the next rolling PR.

Each package is still proven alone (exercise test + fingerprint) before it stays on the branch. Failures are reverted and kept in the PR body so the next day does not rediscover them from scratch.

## Best practices

- One rolling PR; many proven commits on that branch.
- Majors: exercise test + fingerprint freeze; no auto-merge.
- Security: skip cooldown; do not skip tests or fingerprints.
- New feature dependencies belong in that feature's slice, not this maintenance path.

## Related

- [Update dependencies](../how-to/update-dependencies.md)
- [Install agent skills](../how-to/install-agent-skills.md)
- [Bun catalogs](https://bun.sh/docs/install/catalogs)
