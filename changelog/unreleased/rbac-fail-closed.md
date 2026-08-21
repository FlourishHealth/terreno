---
category: Changed
---

- RBAC `createView: "deny"` and unknown field-view names fail closed instead of granting a
  full mask. Nested field omits clone documents; write masks honor dotted paths. Bulk create
  and array mutations apply the same write mask as single-document writes.
- AdminApp model CRUD requires resource actions in addition to `admin:access`. Self-service
  still cannot write User `admin`/`roles`; admin CRUD may set `admin`, and RBAC `roles`
  go through `RoleManager.assign`. Assign and unassign also require the actor to
  already hold the target user's current permissions. The seeded `auditor` role no longer receives
  `admin:access` via read-only expansion. Mutating admin CRUD for a resource missing
  from statements fails closed.
- `runActionPermissions` combines legacy `action.permissions` with RBAC instead of replacing
  them. Create/list responses always apply the **read** field mask. Per-router `access.scope`
  extra PermissionSets are evaluated on HTTP and realtime reads. Role assignment previews
  invalidate cache after dry-run. Invalid permission sets use a stable `APIError.title`.
