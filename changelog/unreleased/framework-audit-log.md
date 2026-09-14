---
category: Added
---

Opt-in append-only `AuditEvent` log. Register `AuditApp` and set `audit: true` (or
`{redact: ["ssn"]}`) on `modelRouter` so successful HTTP CRUD and array mutations
persist redacted changed-field diffs. AdminApp writes the same collection when the
plugin is registered; RBAC uses `persistRbacAuditToAuditEvent`. List/read is
admin-only at `GET /audit-events` and `/admin/audit-events`; create/update/delete
over HTTP return 405. Persist is fire-and-forget; set `GCP_TASKS_AUDIT_QUEUE` and
`AUDIT_TASKS_URL` to enqueue Cloud Tasks instead of writing Mongo on the request.
Default retention is forever; `retentionDays` adds a Mongo
TTL index on `created`. See `docs/how-to/audit-log.md`.
