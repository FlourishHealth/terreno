---
category: Fixed
---

# Preview Cloud Run binds PORT before Mongo

example-backend listens on `PORT` before connecting to MongoDB and attaching
the Terreno Express app. GitHub Actions preview deploys overwrite Cloud Run
revision secrets, smoke-test the same `JOBS_*` env as the revision, drop the
existing `pr-<n>` tag, and set a unique `--revision-suffix` so a failed tagged
revision cannot pin later deploys.
