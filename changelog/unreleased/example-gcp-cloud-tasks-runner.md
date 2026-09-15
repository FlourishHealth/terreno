---
category: Changed
---

# Example backend Cloud Tasks runner

The deployed example backend selects `JOBS_RUNNER=gcp-cloud-tasks`, verifies Cloud
Tasks OIDC on `POST /jobs/execute`, and points each PR preview at its matching
tasks-service tag. The API process starts the schedule ticker; the tasks service
does not. The compiled Cloud Run binary injects a statically imported
`CloudTasksClient`. Queue and worker service resources live in Infra Manager.
