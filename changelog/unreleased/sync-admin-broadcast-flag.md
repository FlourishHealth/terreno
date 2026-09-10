---
category: Added
---

`SyncConfig.adminBroadcast` (default `false`) is stored on collection registration. When `true`, change-stream `sync:delta` emission also targets `{collection}|admin`. Admin clients join that stream with `sync:subscribe {mode: "window"}` (`createSyncDb({windowCollections})`) and skip `GET /sync/snapshot` paging for those collections. Window subscribe requires an admin user. `hydrateWindow` upserts REST ids and fills gaps from `GET /sync/entities` (unknown ids ignored). An admin `GET /sync/entities` on an `adminBroadcast` collection is not limited to owner/tenant stream membership. `{collection}|admin` deltas apply only to ids already in the local window; Refresh is REST + `hydrateWindow`.
