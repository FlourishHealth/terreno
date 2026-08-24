---
category: Changed
---

PR GitHub Actions spend fewer minutes on docs, Playwright, Expo fingerprints,
Maestro, and the example-backend Docker check. Docs previews build only the
current version (unminified, no local search index) and reuse generated
TypeDoc/component MDX when the source hashes match. Docusaurus Faster
(Rspack) is on for PR and `master`; production still builds every versioned
tree.

CI pins Bun `1.4.0` instead of `latest`. Playwright e2e compiles the workspace
once per run and shares `dist/` with the spec shards. Example-backend CI
compiles `@terreno/*` deps in one process and watches `api/**`. The backend
Docker check rebuilds only when the image recipe changes; CD still builds
preview images from source.

Backend startup now defers sync index creation until after MongoDB connects.
This prevents import-time Mongoose buffering timeouts from blocking Cloud Run
containers before they begin listening.
