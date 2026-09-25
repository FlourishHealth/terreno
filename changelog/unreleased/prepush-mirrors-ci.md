---
category: Changed
---

- `bun run prepush` now runs the local mirror of every CI job the branch triggers, using the CircleCI path-filter mapping. That covers package `test:coverage` plus the new-file LCOV gate, `ui` types, example-backend and example-frontend tests, every `repo-policies` step, rulesync drift, and the typedoc API reference. It runs every step even after a failure and prints a summary. Use `--dry-run` to see the plan and `--all` to run everything.
- New `bun run check:test-isolation` blocks new `mock.module` calls in shared Bun test suites (see `docs/explanation/test-isolation.md`).
- The lifecycle plugin now makes one commit per task after Roast `PASS` with no bookkeeping commits, keeps pushes out of Pick and Roast, has Pick list edge cases before coding, has Roast run the CI-equivalent package gate, and has Taste merge `master` only when the PR conflicts, a failure traces to base drift, or the branch is merge-ready.
- Taste invoked directly by a human now repeats bounded reactions (at most 3 fix pushes and 3 hours of waiting) until `PASS`, `BLOCKED`, or `FAIL` instead of returning `PENDING`, and a directly invoked Brew starts Taste as its next stage.
