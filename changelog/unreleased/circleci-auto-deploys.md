---
category: Changed
---

CircleCI path filters start Netlify and GCP production and PR preview jobs.
Those jobs skip (exit 0) until `terreno-netlify` and `terreno-gcp` are filled.
GitHub Actions remains the live deployer in that window. After CircleCI
secrets exist and a deploy succeeds, set the GHA deploy workflows back to
`on: []` so terraform is not applied twice. Fork PRs skip CircleCI previews.
Preview cleanup on PR close uses GitHub `preview-cleanup.yml`.
