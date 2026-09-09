---
category: Deprecated
---

`modelRouter` `realtime` and `@terreno/rtk` cache-patching helpers (`realtimeList`,
`realtimeDocument`, `setRealtimeSocket`, `getRealtimeSocket`) are deprecated and will
be removed in Terreno **58**. Migrate collection live updates to `sync` +
`@terreno/syncdb`. `RealtimeApp` remains required for sync sockets. See
[migrate-rtk-to-syncdb.md](../../docs/how-to/migrate-rtk-to-syncdb.md) and
[remove-legacy-realtime.md](../../docs/tasks/remove-legacy-realtime.md).
