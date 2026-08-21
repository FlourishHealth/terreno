---
category: Changed
---

- RBAC `createView: "deny"` and unknown field-view names fail closed instead of granting a
  full mask. Nested field omits clone documents; write masks honor dotted paths. Bulk create
  and array mutations apply the same write mask as single-document writes.
- AdminApp model CRUD requires resource actions in addition to `admin:access`. Self-service
  still cannot write User `admin`/`roles`. Without RBAC, admin CRUD may set `admin`.
  With RBAC, `roles` go through `RoleManager.assign`. Changing `admin` requires
  `rbac:assignRoles`, and granting `admin: true` also requires `rbac:manageRoles`
  unless the actor already has the legacy admin flag. Unchanged echoed `admin`
  values are allowed. assign/unassign require the actor to already hold the
  target user's current permissions. The seeded `auditor` role no longer receives
  `admin:access` via read-only expansion. Mutating admin CRUD for a resource missing
  from statements fails closed.
- MCP model tools use resolved RBAC options (TerrenoApp-injected and the
  documented `access` + `accessControl` path, including pathless `modelRouter`)
  instead of the pre-build legacy permission arrays. Create/update also apply
  `validateAccessWritePayload` (field views / `createView: "deny"`).
  User `roles` on modelRouter writes (HTTP, sync, and MCP) are dropped when
  `accessControl` is set.
  Example-backend `backfillAdmins` is dry-run unless `RBAC_BACKFILL_ADMINS=true`.
- `runActionPermissions` combines legacy `action.permissions` with RBAC instead of replacing
  them. Create/list responses always apply the **read** field mask. Per-router `access.scope`
  extra PermissionSets are evaluated on HTTP and realtime reads. Role assignment previews
  invalidate cache after dry-run. Invalid permission sets use a stable `APIError.title`.
