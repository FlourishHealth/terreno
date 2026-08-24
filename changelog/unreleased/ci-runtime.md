---
category: Changed
---

PR GitHub Actions spend fewer minutes on docs, Playwright, Expo fingerprints,
Maestro, and the example-backend Docker check. Docs previews build only the
current version (unminified) and reuse generated TypeDoc/component MDX when
the source hashes match; production `master` deploys still build every
versioned tree.
