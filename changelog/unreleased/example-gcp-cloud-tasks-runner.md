---
category: Changed
---

# Example backend Cloud Tasks runner

The deployed example backend selects `JOBS_RUNNER=gcp-cloud-tasks`, verifies Cloud
Tasks OIDC on `POST /jobs/execute`, and points each PR preview at its matching
tasks-service tag. GitHub Actions and CircleCI both deploy that tag. The API
process starts the schedule ticker; the tasks service does not. The compiled Cloud Run binary enqueues through the Cloud Tasks REST
API (`google-auth-library`) because `@google-cloud/tasks` cannot load its JSON
config from a `bun build --compile` image. Queue and worker service resources
live in Infra Manager.
