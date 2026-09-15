---
category: Changed
---

Admin panel HTTP script runs enqueue durable job `admin/script` when `JobsApp` is registered.
The Scripts UI still polls `BackgroundTask`. CLI script runs stay in-process. See
`docs/how-to/background-jobs.md`.
