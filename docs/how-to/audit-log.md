# Enable the framework audit log

Register `AuditApp` and set `audit: true` on routers you want logged. Successful HTTP mutations write append-only `AuditEvent` rows. Default retention is forever.

## Steps

### 1. Register the plugin

```typescript
import {AuditApp, TerrenoApp} from "@terreno/api";

new TerrenoApp({userModel: User}).register(new AuditApp()).start();
```

Importing `@terreno/api` does not register `AuditEvent`. HTTP list/read is admin-only at `GET /audit-events`. Create/update/delete over HTTP are disabled (405).

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

`source` is `modelRouter` for these writes. Secrets (`password`, `hash`, `salt`, `token`, `secret`, `refreshToken`) are omitted; extra `redact` names merge with that list.

AdminApp auto-write and RBAC fan-in land in later slices of the [framework audit log IP](../implementationPlans/framework-audit-log.md).
