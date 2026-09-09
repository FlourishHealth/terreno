---
category: Added
---

`SyncConfig.adminBroadcast` (default `false`) is stored on collection registration. When `true`, change-stream `sync:delta` emission also targets `{collection}|admin` without a second `registerSync`.
