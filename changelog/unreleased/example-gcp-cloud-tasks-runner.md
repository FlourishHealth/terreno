---
category: Changed
---

# Example backend Cloud Tasks runner

The deployed example backend selects `JOBS_RUNNER=gcp-cloud-tasks`, verifies Cloud
Tasks OIDC on `POST /jobs/execute`, and points each PR preview at its matching
tasks-service tag. GitHub Actions and CircleCI both deploy that tag, and production
deploys overwrite env vars so preview `MONGO_DB_NAME` / `PR_NUMBER` cannot stick.
The API
process starts the schedule ticker; the tasks service does not. The compiled Cloud Run binary enqueues through the Cloud Tasks REST
API (`google-auth-library`) because `@google-cloud/tasks` cannot load its JSON
config from a `bun build --compile` image. Enqueued HTTP tasks set
`dispatchDeadline` to 1800 seconds so Cloud Tasks does not retry a still-running
30-minute handler at the 10-minute HTTP default. Queue and worker service resources
live in Infra Manager.
