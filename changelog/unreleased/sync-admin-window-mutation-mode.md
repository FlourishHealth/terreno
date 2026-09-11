---
category: Added
---

Admin-window sync writes use an explicit `mutationMode: "adminWindow"` marker on `POST /sync/mutate`, `POST /sync/mutate/batch`, `sync:mutate`, and `sync:mutateBatch`. `createSyncDb({windowCollections})` tags matching outbox rows automatically. The server validates the marker together with `adminBroadcast`, admin-window access, and a registered AdminApp write scope, then applies AdminApp create/update/delete permissions, `writeOwned` ownership, readonly/hidden stripping, and audit hooks before running the product sync executor. Product clients without the marker keep existing product sync permissions.
