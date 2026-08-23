---
category: Changed
---

Upgraded the toolchain to Bun 1.4. EAS build profiles, EAS workflows, and the
GitHub Actions jobs that pinned Bun now use `1.4.0`, `@types/bun` and `bun-types`
move to `^1.4.0`, and apps scaffolded by `@terreno/mcp` get `@types/bun@^1.4.0`.
Contributors should run Bun 1.4 or newer locally.
