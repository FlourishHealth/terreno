---
category: Fixed
---

# Preview Cloud Run binds PORT before Mongo

example-backend listens on `PORT` before connecting to MongoDB and attaching
the Terreno Express app. If that boot later throws, the process closes the
holder and exits so Cloud Run does not keep a 503 listener. GitHub Actions
preview deploys overwrite Cloud Run revision secrets, smoke-test the same
`JOBS_*` env as the revision, rebuild traffic from Ready revisions (omitting
failed tags), deploy `--no-traffic` without `--tag`, then tag the new revision.
