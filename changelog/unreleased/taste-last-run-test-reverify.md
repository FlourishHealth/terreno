---
category: Changed
---

Taste records failed tests from the last product-CI run and re-verifies those exact
local commands before any GitHub push. `prepush` does not substitute for that
re-verify. Example-frontend now exposes `test:ci` so root `bun run test` includes it.
Cursor Cloud test mapping lives in `docs/how-to/run-tests-locally.md`. Plugin
`terreno-planning` is `2.12.0`.
