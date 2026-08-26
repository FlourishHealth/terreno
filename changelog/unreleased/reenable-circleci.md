---
category: Changed
---

CircleCI is enabled again for package CI, repo policies, and Playwright e2e
(`.circleci/config.yml` setup + path-filtering). Config-only PRs run a small
smoke slice; mixed PRs skip that slice so path-filtered jobs are not doubled.
E2E shards share one compile + `expo export`. `rulesync-check` runs only when
rule sources change. Deploys stay on GitHub Actions. See
`docs/how-to/circleci.md`.
