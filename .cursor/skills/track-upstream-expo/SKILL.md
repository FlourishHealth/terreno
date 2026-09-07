---
name: track-upstream-expo
description: 'Morning job: probe for a newer Expo SDK beta, fail fast when none exists, otherwise create or continue release-X.Y.Z, upgrade Expo, and land native fingerprint deps on that branch. Trigger with /track-upstream-expo, "track upstream expo", "check expo beta", or "morning expo probe".'
disable-model-invocation: true
---
# Track upstream Expo

Daily maintainer job. Watch Expo `next` / the next SDK major. When a newer beta
exists, work on `release-X.Y.Z` (Expo `58.0.0-preview.1` → `release-58.0.0`).
Roll native-affecting catalog packages on that same branch so later master
patches do not change the EAS fingerprint.

Human twin: [`docs/how-to/track-upstream-expo.md`](../../docs/how-to/track-upstream-expo.md).
Upgrade mechanics: invoke `upgrading-expo`. Do not copy that checklist here.
Native package list: [`references/native-packages.md`](references/native-packages.md).

## Hard rules

1. **Probe first. Exit 1 means stop.** Do not create a branch, bump deps, or
   "check anyway."
2. **SDK majors only.** A 57.0.15 patch of the catalog major is not this job.
3. **Long-lived `release-*` branch.** Do not merge to master from this skill.
4. **Native deps ride the SDK branch.** Do not land `react-native-*` / Expo
   native module bumps on master patches.

## Step 1: Probe (fail fast)

From a clean `master` with `origin` fetched:

```bash
git checkout master && git pull origin master
bun run expo:track-probe
```

| Exit | Meaning | Agent action |
| --- | --- | --- |
| `1` | No newer SDK branch/beta | Print the JSON `reason`. **Stop the session.** |
| `0` | Work to do | Read `action`, `releaseBranch`, `expoVersion`, `npmTag`. Continue. |
| `2` | Probe infrastructure failed | Fix network/git/registry. Do not skip the probe. |

Completion: you either stopped on exit `1`, or you have a JSON result with
`action` `create-branch` or `continue-branch`.

Tracker file: `scripts/track-upstream-expo/tracked.json`. The probe also reads
`origin/<releaseBranch>:scripts/track-upstream-expo/tracked.json` when that
branch exists, so a previous day's work on the release branch counts even if
master's tracker is stale.

## Step 2: Branch

`create-branch`:

```bash
git fetch origin master
git checkout -B <releaseBranch> origin/master
```

`continue-branch`:

```bash
git fetch origin <releaseBranch> master
git checkout <releaseBranch>
git merge origin/master
```

Completion: `git branch --show-current` equals `releaseBranch` from the probe.
Tree is not `master`.

## Step 3: Install the probed Expo

Pin the **exact** `expoVersion` from the probe (not a floating `@next` that
could move mid-day). Follow `upgrading-expo` for install, `expo install --fix`,
doctor, breaking-change references, and CNG/prebuild rules.

Write versions back to the **root catalog**, then `bun install` from the repo
root. Apps use `"expo": "catalog:"`.

Completion: root `package.json` `catalog.expo` equals the probed version
(range prefix `~` is allowed). `npx expo-doctor` has been run in
`example-frontend`, `demo`, and `admin-spa`.

## Step 4: Native fingerprint deps

Load [`references/native-packages.md`](references/native-packages.md). For every
catalog package on that list:

1. Prefer the version `expo install --fix` selected for the new SDK.
2. If Expo does not pin it, take the newest version that still compiles with
   this SDK (changelog + install, then compile).
3. Write one catalog version. Do not leave app `package.json` files on raw
   versions for shared native deps.

Do **not** add new native modules in this job unless Expo's SDK install pulled
them in as required peers.

Completion: every listed catalog native package is either bumped to the
SDK-compatible latest or recorded in the PR as "left at X because Y failed."
No listed package is silently skipped.

## Step 5: Fix the branch

Keep going until these pass, or you record a blocker with the first error line:

```bash
bun run compile
bun run lint
bun run ui:test
bun run frontend:lint
cd example-frontend && bunx expo-doctor
cd demo && bunx expo-doctor
```

Fix compile/test/doctor failures in this same session. Use `upgrading-expo`
references for API moves (React 19, native tabs, expo-av, and so on).

Completion: compile is green, or the PR `Verification` table has a `⚠️`
blocker naming the command and first error.

## Step 6: Record the tracked beta

Update `scripts/track-upstream-expo/tracked.json`:

```json
{
  "expoVersion": "<probe expoVersion>",
  "npmTag": "<probe npmTag>",
  "releaseBranch": "<probe releaseBranch>",
  "sdkLine": "<probe sdkLine>",
  "updatedAt": "<ISO timestamp>"
}
```

Commit on the **release branch**. Tomorrow's probe reads this file from
`origin/<releaseBranch>`.

Completion: `tracked.json` `expoVersion` matches the installed catalog Expo
version (without `~`/`^`).

## Step 7: Push

Push `release-*` to origin. Open or update a PR **into master** as draft. Do
not merge. Title: `Expo <sdkLine> (<expoVersion>)`.

If master's `tracked.json` is still on the previous SDK, say so in the PR:
tomorrow still works because the probe reads the release-branch copy.

Completion: `git ls-remote --heads origin <releaseBranch>` is non-empty.
