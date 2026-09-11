# Enable the framework audit log

Register `AuditApp` and set `audit: true` on routers you want logged. Successful HTTP mutations write append-only `AuditEvent` rows. Default retention is forever.

## Steps

### 1. Register the plugin

```typescript
import {AuditApp, TerrenoApp} from "@terreno/api";

new TerrenoApp({userModel: User}).register(new AuditApp()).start();
```

Importing `@terreno/api` does not register `AuditEvent`. HTTP list/read is admin-only at `GET /audit-events` and `GET /admin/audit-events`. Create/update/delete over HTTP are disabled (405), including the admin remount.

### 2. Opt in per router

```typescript
modelRouter("/todos", Todo, {
  audit: true, // or {redact: ["ssn"]}
  permissions: {
    /* ... */
  },
});
```

`audit: true` without `AuditApp` still returns 2xx and logs an error once per process.

## Operations

| HTTP | `verb` | `operation` | Diff |
| --- | --- | --- | --- |
| POST `/` | `created` | `create` | `after` only |
| PATCH `/:id` | `updated` | `update` | Changed fields in `before` / `after` |
| DELETE `/:id` | `deleted` | `delete` | `before` only |
| POST `/:id/:field` | `updated` | `arrayPush` | Changed fields; `recordId` set |
| PATCH `/:id/:field/:itemId` | `updated` | `arrayUpdate` | Changed fields; `recordId` set |
| DELETE `/:id/:field/:itemId` | `updated` | `arrayRemove` | Changed fields; `recordId` set |

`source` is `modelRouter` for these writes. Secrets (`password`, `hash`, `salt`, `token`, `secret`, `refreshToken`) are omitted at every object and array depth; extra `redact` names merge with that list.

### 3. Admin mutations

When `AuditApp` is registered, AdminApp writes the same `AuditEvent` collection with
`source: "admin"` after successful admin POST/PATCH/DELETE. You do not need `onAdminAudit` for
that. `onAdminAudit` remains an extra sink if the app still wants a second destination.

RBAC mutations fan into the same collection when `createAccess({auditSink: persistRbacAuditToAuditEvent})` is set. `source` is `rbac`.

`organizationId` is copied onto the event when `req.organization` is set (`id` or `_id`), otherwise from the mutated document's `organizationId` string. The field is omitted when neither exists. Org-admin list filtering waits on org management UI.

### 4. Retention

Omit `retentionDays` or set `0` to keep events forever (no TTL index). `new AuditApp({retentionDays: 90})` creates a Mongo TTL index on `created` with `expireAfterSeconds = 90 * 86400`, replacing the default `{created: 1}` field index so Mongo does not reject a duplicate key pattern. Mongo expires documents in the background; lowering or removing TTL later requires dropping that index yourself (`db.auditevents.dropIndex(...)`) — Mongoose will not remove it.
