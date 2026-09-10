---
category: Added
---

`@terreno/jobs` adds durable background work for Terreno backends: MongoDB-persisted jobs
with retries, dead-lettering, cron schedules (IANA timezones), admin list/detail/retry/requeue/cancel,
and pluggable runners (`MongoJobRunner`, GCP Cloud Tasks, Vercel Queues, custom). Workers start
only via explicit `startWorker()` — register `JobsApp` on `TerrenoApp`, define handlers, enqueue
with `getJobsService()`, and choose in-process or standalone worker processes. Admin UI widgets
ship in `@terreno/admin-frontend`. See `docs/how-to/background-jobs.md` and
`docs/reference/jobs.md`.
