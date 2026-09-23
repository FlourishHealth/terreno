---
category: Changed
---

CircleCI is now the only continuous deployer for the Netlify demo, example frontend, and docs sites and for GCP terraform, Cloud Run backend/tasks, and MCP. The GitHub Actions deploy workflows are disabled for rollback only, and CircleCI deploy jobs fail instead of skipping when `terreno-netlify` or `terreno-gcp` is missing a value.
