---
category: Added
---

Opt-in append-only `AuditEvent` log. Register `AuditApp` and set `audit: true` (or
`{redact: ["ssn"]}`) on `modelRouter` so successful HTTP CRUD and array mutations
persist redacted changed-field diffs. AdminApp writes the same collection when the
plugin is registered; RBAC uses `persistRbacAuditToAuditEvent`. List/read is
admin-only at `GET /audit-events`; create/update/delete over HTTP return 405.
Default retention is forever; `retentionDays` adds a Mongo TTL index on `created`.
See `docs/how-to/audit-log.md`.
