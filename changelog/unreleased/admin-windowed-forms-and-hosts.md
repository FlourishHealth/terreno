---
category: Added
---

Built-in admin String-`_id` model CRUD can now run windowed local-first through
`@terreno/syncdb`: REST supplies membership, TinyBase supplies live rows,
create/update/delete use the durable outbox, bulk patch stays server-side, and
`ConflictSheet` resolves admin-loaded records. The embedded example and
standalone admin SPA demonstrate Bearer and same-origin cookie hosts.
