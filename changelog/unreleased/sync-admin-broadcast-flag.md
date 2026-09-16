---
category: Added
---

`SyncConfig.adminBroadcast` (default `false`) is stored on collection registration. When `true`, change-stream `sync:delta` emission also targets `{collection}|admin`. Admin clients join that stream with `sync:subscribe {mode: "window"}` (`createSyncDb({windowCollections})`) and skip `GET /sync/snapshot` paging for those collections. Window subscribe requires admin panel and model-list access. `hydrateWindow` renders REST rows immediately, then refreshes canonical seq/deleted metadata for every requested id through `GET /sync/entities` (unknown ids ignored). AdminApp list/read permissions and `queryFilter` apply to hydrate and live deltas. `{collection}|admin` deltas apply only to ids already in the local window; Refresh is REST + `hydrateWindow`.
