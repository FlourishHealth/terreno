---
category: Changed
---

Upgraded the toolchain to Bun 1.4. The GitHub Actions jobs that pinned an exact
Bun version now use `1.4.0`, `@types/bun` and `bun-types` move to `^1.4.0`, and
apps scaffolded by `@terreno/mcp` get `@types/bun@^1.4.0`. Contributors should
run Bun 1.4 or newer locally. EAS build profiles keep their existing Bun pin:
`eas.json` is an Expo fingerprint input, so bumping it would change the native
runtime version and force a rebuild for a toolchain-only change.
