---
category: Changed
---

CircleCI now owns production Netlify and GCP deploys, semver-tag npm releases,
and manual preview cleanup, preview deploy, EAS development build, and
single-package publish operations. Matching GitHub CI/CD workflows are retained
with `on: []` for rollback. CircleCI uses OIDC for GCP; no service-account JSON
key is required.
