---
category: Added
---

Admin-window sync writes use an explicit `mutationMode: "adminWindow"` marker on `POST /sync/mutate`, `POST /sync/mutate/batch`, `sync:mutate`, and `sync:mutateBatch`. `createSyncDb({windowCollections})` tags matching outbox rows automatically. The server validates the marker together with `adminBroadcast`, admin-window access, and a registered AdminApp write scope, then runs the shared sync executor with AdminApp pre/post hooks (not product `modelRouter` hooks), applying the same permission, stripping, User admin-flag/role gates, and audit semantics as REST. Product clients without the marker keep existing product sync permissions and hooks.
