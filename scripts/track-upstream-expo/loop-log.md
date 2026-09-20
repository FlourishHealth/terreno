# Expo SDK loop log

Handoff file for `/track-upstream-expo`. The next morning reads this before
changing code. Keep it on the `release-*` branch once a loop starts.

Template: `.rulesync/skills/track-upstream-expo/references/loop-log.md`.

## Status

- sdkLine: none
- expoVersion: 57.0.14 (master catalog)
- releaseBranch: none
- loopStatus: idle
- updatedAt: 2026-09-07T00:00:00.000Z

## Next

No in-flight SDK loop. Run `bun run expo:track-probe`. Exit 1 means stop.

## Open

None.

## Tried (newest first)

None.

## Do not retry

None.

## Worked

None.

## Release notes draft

Empty until a `release-*` loop starts. Accumulate Expo API moves, native
fingerprint bumps, and consumer-facing breaks here. Copy into `CHANGELOG.md`
and `mcp-server/src/docs/upgrades/<version>.md` only when cutting the Terreno
release — not during the morning loop.
