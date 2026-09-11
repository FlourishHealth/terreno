---
category: Changed
---

Taste now runs a repository root's `prepush` package script, when present, in its fresh
no-context subagent before pushing. Repositories own the exact local gate; when the
script is absent, Taste retains its affected-package lint, typecheck, and test fallback.
Terreno's root `prepush` gate runs workspace lint, TypeScript compilation, and full
Knip/dependency-cruiser static analysis. Plugin `terreno-planning` is `2.10.0`.
