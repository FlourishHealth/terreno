---
category: Fixed
---

`@terreno/syncdb` no longer misses server changes that land between its startup snapshot
and the socket joining a stream's room: each `sync:subscribed` confirmation now pages the
streams it names from their cursor, instead of leaving the client stale until the next
periodic reconcile
