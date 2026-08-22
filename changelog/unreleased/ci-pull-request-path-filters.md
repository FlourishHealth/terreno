---
category: Changed
---

GitHub Actions package CI (API, AI, UI, RTK, comms, syncdb, examples, E2E, Maestro, admin SPA) now runs on `pull_request` with path filters, and on `push` only to `master`. This stops the first push of a new branch from ignoring path filters and running unrelated jobs (the 13 Playwright shards were the main cost). Docs-only and rules-only PRs skip package CI, Rulesync, CD, and frontend/demo deploy workflows. Example Frontend Deploy PR path filters match the frontend build gate (backend-only PRs skip the workflow; mixed PRs still retarget preview `BASE_URL`).
