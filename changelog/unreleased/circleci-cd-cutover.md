---
category: Changed
---

CircleCI provides Netlify and GCP deploy jobs, semver-tag npm releases, and
manual preview cleanup, preview deploy, EAS development build, and
single-package publish operations. Automatic production deploy path triggers
stay paused until the Netlify contexts and GCP OIDC bootstrap pass manual
verification. Matching GitHub CI/CD workflows are retained with `on: []` for
rollback. CircleCI uses OIDC for GCP; no service-account JSON key is required.
