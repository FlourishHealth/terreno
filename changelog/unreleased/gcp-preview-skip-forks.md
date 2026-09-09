---
category: Fixed
---

GitHub `cd.yml` GCP preview jobs (`terraform-preview`,
`backend-deploy-preview`) and `preview-cleanup.yml` skip fork pull requests.
OIDC `id-token` is granted only on jobs that authenticate to GCP, not the
whole workflow. Fork PRs keep `repository: FlourishHealth/terreno` on the
token, so WIF would otherwise accept them.
