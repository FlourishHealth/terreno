---
category: Fixed
---

CircleCI automatic Netlify and GCP production path triggers are paused until
their contexts and OIDC bootstrap pass manual verification. Netlify jobs now
validate credentials before expensive builds, docs builds avoid minification to
fit the available executor memory, and the Terraform configuration is formatted.
