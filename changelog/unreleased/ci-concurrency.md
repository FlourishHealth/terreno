---
category: Changed
---

CircleCI starts fewer concurrent jobs: repository policies share one `repo-policies` check, Playwright runs five shards instead of one container per spec, and path filters no longer start example-backend / new-file-coverage for unrelated UI, RTK, or e2e-spec-only changes. `repo-policies` uses Node 22.14 for Knip. Require `repo-policies`; treat `e2e-*` shard names as path-filtered (config-only PRs post `e2e-auth`).
