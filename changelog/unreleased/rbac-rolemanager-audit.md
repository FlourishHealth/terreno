---
category: Changed
---

- `RoleManager` writes `RbacAudit` (with `permissionDelta`) on create, update, remove, assign,
  and unassign. Denied escalation attempts are stored with `denied: true`. HTTP `rbacRouter`
  no longer writes a second audit row.
- `RbacRole.seedDefaults` accepts `extraRoles` and shares `upsertSeededRole` with
  `RoleManager.seedDefaults`. `previewRoleChange` reports a real `affectedUserCount`.
- Importing `@terreno/api` no longer registers `RbacRole` / `RbacAudit` on the default
  mongoose connection. Use `createAccess({connection})` or `createRbacRoleModel` /
  `createRbacAuditModel`. The `RbacRoleModel` / `RbacAuditModel` singletons are removed;
  the `RbacRoleModel` type remains.
- The RBAC implementation plan is Complete (phases 1–6 shipped).
