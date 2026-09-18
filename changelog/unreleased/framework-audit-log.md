---
category: Added
---

Opt-in append-only `AuditEvent` log. Register `AuditApp` and set `audit: true` (or
`{redact: ["ssn"]}`) on `modelRouter` so successful HTTP CRUD and array mutations
persist redacted changed-field diffs. Default redaction includes compound keys such as
`tokenHash`. AdminApp writes the same collection when the plugin is registered and omits
each model's `hiddenFields` / `excludeFields`; RBAC uses
`persistRbacAuditToAuditEvent`. List/read is admin-only at `GET /audit-events` and
`/admin/audit-events`; create/update/delete over HTTP return 405. Persist is
fire-and-forget; a non-24-hex `actorId` (including 12-character strings mongoose would
accept) is dropped from the event instead of dropping the event. Update/delete snapshots
run only when `audit` is on, and a throwing `toJSON` does not fail the mutation. Set `GCP_TASKS_AUDIT_QUEUE` and `AUDIT_TASKS_URL` to enqueue Cloud Tasks
instead of writing Mongo on the request. Default retention is forever; `retentionDays`
adds a Mongo TTL index on `created`. See `docs/how-to/audit-log.md`.
