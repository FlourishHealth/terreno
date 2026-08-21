---
category: Fixed
---

- `seedDefaults` no longer overwrites customized unsealed roles on restart; sealed defaults still refresh from code.
- Admin `/bulk-patch` authorizes each target document, so scoped `update` cannot patch out-of-scope ids.
- Admin User CRUD can set the `admin` flag when RBAC is off. With RBAC, `roles` go through `RoleManager.assign`, and writing `admin` requires `rbac:assignRoles`.
- Permission resolver caches evict expired and overflow entries so distinct identities cannot grow unbounded.
- Clearing a role description in the admin UI sends `null` so PATCH removes the field.
- Admin User create rolls back the new row if `RoleManager.assign` fails after insert.
- `assign` / `unassign` refuse to change a user whose current permissions the actor does not hold.
