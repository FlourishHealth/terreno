---
category: Added
---

Admin comms dashboard: filter and inspect delivery logs, retry failed sends (including bulk retry
with a cap), and view per-provider failure rates. Created and attempt timestamps print in the
operator locale. List, stats, and bulk retry share a trailing 7-day window when dates are omitted.
Retry returns the log row created by that send. Routes live on `@terreno/comms`; screens ship in
`@terreno/admin-frontend` as the `comms` custom screen.
