---
category: Fixed
---

- `seedDefaults` no longer overwrites customized unsealed roles on restart; sealed defaults still refresh from code.
  API tests clear `RbacRole` / `RbacAudit` in `setupDb` so leftover unsealed names cannot leak across cases.
- Admin `/bulk-patch` authorizes each target document, so scoped `update` cannot patch out-of-scope ids.
- Admin User CRUD can set the `admin` flag when RBAC is off. With RBAC, changing `admin` requires `rbac:assignRoles`; echoed unchanged `admin` values on create/update do not.
- Permission resolver caches evict expired and overflow entries so distinct identities cannot grow unbounded.
- Clearing a role description in the admin UI sends `null` so PATCH removes the field.
- Admin User create rolls back the new row if `RoleManager.assign` fails after insert.
- `assign` / `unassign` refuse to change a user whose current permissions the actor does not hold.
- MCP model tools pick up TerrenoApp-injected `accessControl` (permissions, query filters, write masks) instead of keeping the pre-build legacy checks.
