---
category: Changed
---

PR GitHub Actions spend fewer minutes on docs, Playwright, Expo fingerprints,
Maestro, and the example-backend Docker check. Docs previews build only the
current version (unminified, no local search index) and reuse generated
TypeDoc/component MDX when the source hashes match. Docusaurus Faster
(Rspack) is on for PR and `master`; production still builds every versioned
tree.
