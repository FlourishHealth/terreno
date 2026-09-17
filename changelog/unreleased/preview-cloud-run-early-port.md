---
category: Fixed
---

# Preview Cloud Run binds PORT before Mongo

example-backend listens on `PORT` before connecting to MongoDB and attaching
the Terreno Express app. GitHub Actions preview deploys overwrite Cloud Run
revision secrets and smoke-test the same `JOBS_*` env as the revision so leftover
Langfuse keys and a jobs-runner boot gap cannot hide behind a passing smoke.
