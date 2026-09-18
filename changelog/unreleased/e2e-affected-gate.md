---
category: Changed
---

CircleCI Playwright shards now run only when a changed file can reach them. `e2e-prepare` resolves the affected shards with `bun run check:e2e-affected` (import graph with barrel, lazy-registry, and lockfile resolution) and each shard halts before `bun install` when it is unaffected. The gate fails open on anything it cannot resolve. See [circleci.md](../../docs/how-to/circleci.md#e2e-affected-gate).
