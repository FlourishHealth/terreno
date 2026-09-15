---
category: Changed
---

Admin panel HTTP script runs enqueue durable job `admin/script` when `JobsApp` is registered.
The Scripts UI still polls `BackgroundTask`. CLI script runs stay in-process. See
`docs/how-to/background-jobs.md`.

The deployed example backend dispatches these jobs through an Infra Manager-managed
Google Cloud Tasks queue to a private Cloud Run execution service. PR previews use
matching service tags and Mongo databases so concurrent previews cannot consume each
other's jobs.
