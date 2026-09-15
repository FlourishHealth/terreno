---
category: Deprecated
---

`@terreno/admin-frontend`'s `useAdminApi` RTK `injectEndpoints` path and required
`api` prop are deprecated. Terreno 57 retains them for ObjectId/API-only
compatibility; Terreno 58 removes them. New admin RPC uses the host-bound fetch
client, and eligible String-`_id` model CRUD uses windowed syncdb.
