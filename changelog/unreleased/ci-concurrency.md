---
category: Changed
---

CircleCI starts fewer concurrent jobs: repository policies share one `repo-policies` check, Playwright runs five shards instead of one container per spec, and path filters no longer start example-backend / new-file-coverage for unrelated UI, RTK, or e2e-spec-only changes. Require the new check names (`repo-policies`, `e2e-auth`, …) in branch protection.
