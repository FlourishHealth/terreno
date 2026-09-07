# Track upstream Expo SDK betas

Morning maintainer job: see if Expo published a **new SDK major beta**, and if
so keep a long-lived `release-X.Y.Z` branch building.

Agent procedure: skill `track-upstream-expo`. Upgrade commands: skill
`upgrading-expo`.

## 1. Probe (expected failure most days)

From latest `master`:

```bash
bun run expo:track-probe
```

| Exit | Meaning |
| --- | --- |
| `1` | Nothing newer. Stop. JSON `reason` is the record. |
| `0` | Create or continue `releaseBranch` at `expoVersion`. |
| `2` | Probe broke (network/git). Fix that; do not skip. |

The probe ignores patches of the current catalog major (for example 57.0.15
while the repo is on Expo 57). It watches `expo@next` and `expo@latest` for a
**higher major**.

State file: [`scripts/track-upstream-expo/tracked.json`](../../scripts/track-upstream-expo/tracked.json).
The probe also reads that file off `origin/<releaseBranch>` so the release
branch itself is the tracker after the first day.

## 2. Branch name

Expo `58.0.0-preview.1` (or `58.0.0` beta) → git branch `release-58.0.0`.

Create it from `origin/master` the first day. Later days check it out and merge
`master`, then bump to the newer preview.

Do not merge `release-*` to master from this job.

## 3. Native modules stay on the SDK train

Packages that change the EAS fingerprint (`react-native-*`, Expo native
modules, Sentry RN, FlashList, Skia, and the rest listed in the skill) update
**on this branch only**. That is how later master patches keep a stable
fingerprint so Expo Updates can keep serving JS.

## 4. Record the beta

After the bump compiles, set `tracked.json` `expoVersion` to the installed
Expo version and push the release branch.
