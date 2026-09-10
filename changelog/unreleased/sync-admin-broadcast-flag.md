---
category: Added
---

`SyncConfig.adminBroadcast` (default `false`) is stored on collection registration. When `true`, change-stream `sync:delta` emission also targets `{collection}|admin`. Admin clients join that stream with `sync:subscribe {mode: "window"}` (`createSyncDb({windowCollections})`) and skip `GET /sync/snapshot` paging for those collections.
