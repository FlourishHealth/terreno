---
category: Changed
---

- RBAC `createView: "deny"` and unknown field-view names fail closed instead of granting a
  full mask. Nested field omits clone documents; write masks honor dotted paths. Bulk create
  and array mutations apply the same write mask as single-document writes.
- AdminApp model CRUD requires resource actions in addition to `admin:access`. Self-service
  still cannot write User `admin`/`roles`. Without RBAC, admin CRUD may set `admin`.
  With RBAC, `roles` go through `RoleManager.assign`. Changing `admin` requires
  `rbac:assignRoles`, and granting or revoking `admin` also requires
  `rbac:manageRoles` unless the actor already has the legacy admin flag, plus
  the same privilege-subset check as role assign. Unchanged echoed `admin`
  values are allowed. assign/unassign require the actor to already hold the
  target user's current permissions. The seeded `auditor` role no longer receives
  `admin:access` via read-only expansion. Admin CRUD for a resource missing
  from statements fails closed for list/read, search, and writes. Framework statements now
  include `featureFlag`, `consentForm`, and `consentResponse` so superadmin `*`
  can list those admin models; example-backend adds `adminAuditLog` list/read.
  `POST /admin/background-tasks`
  requires `admin:runScripts`; version-config GET/PUT require `configuration:read` /
  `configuration:update`.
- MCP and SyncDB registries use resolved RBAC options (TerrenoApp-injected and the
  documented `access` + `accessControl` path, including pathless `modelRouter`)
  instead of the pre-build legacy permission arrays. Create/update also apply
  `validateAccessWritePayload` (field views / `createView: "deny"`).
  User `roles` on modelRouter writes (HTTP, sync, and MCP) are dropped when
  `accessControl` is set.
  Example-backend `backfillAdmins` is dry-run unless `RBAC_BACKFILL_ADMINS=true`.
- `runActionPermissions` combines legacy `action.permissions` with RBAC instead of replacing
  them. Actions without `access` inherit the router's `access.resource` and the mapped CRUD
  verb (`instance` POST → `update`, `collection` POST → `create`). Example todo
  `bulkComplete` / `markComplete` set `access: {resource: "todo", action: "update"}`
  so they cannot bypass `todo:update`. Empty action permissions and inherited CRUD actions
  mapped to `null` remain disabled. Assignment previews use uncached permission resolution
  on both the current and proposed sets, honor source `staleOnFailure` without writing
  caches, and reject role permissions the actor does not already hold. The admin role
  editor keeps Create/Save in the
  modal footer and scrolls the permission grid so a larger statement vocabulary cannot
  hide the save control. Create/list responses always apply the **read** field
  mask. Per-router `access.scope`
  extra PermissionSets are evaluated on HTTP and realtime reads. Sync and realtime
  serializers accept change-stream BSON post-images (no Mongoose `toObject`) so
  `sync:delta` is not dropped after RBAC wraps `defaultResponseHandler`. Invalid permission sets
  use a stable `APIError.title`.
