# Implementation plan index

Tracks active and completed implementation plans (IP) for Terreno. File paths are relative to `docs/implementationPlans/`.

## Programs

Umbrella plans that coordinate several IPs.

| Program | Status | Created | IPs |
|---------|--------|---------|-----|
| [Open source launch](oss-launch-program.md) | Draft — decisions recorded; Vercel spike open | 2026-07-27 | 15 |

## Active

| Plan | Status | Created | Tasks |
|------|--------|---------|-------|
| [Admin UI v2 — Django-parity admin](admin-ui-v2-django-parity.md) | Approved | 2026-06-15 | [tasks](../tasks/admin-ui-v2-django-parity.md) |
| [@terreno/syncdb-codegen](syncdb-codegen.md) | Draft | 2026-07-08 | [tasks](../tasks/syncdb-codegen.md) |
| [SyncDB local-first data layer (v2)](syncdb-local-first.md) | In progress — Phases 1–8 landed, Phase 9 follow-ups open | 2026-06-23 | [tasks](../tasks/syncdb-local-first.md) |
| [SyncDB hardening (syncdb-2)](terreno-syncdb-2.md) | Implemented — Phases A–F landed; deviations carried into Phase 9 | 2026-07-11 | [tasks](../tasks/syncdb-local-first.md) (Phase 8/9) |
| [SyncDB Phase C design](syncdb-phase-c-design.md) | Implemented — design authority for C1–C8 | 2026-07-11 | [tasks](../tasks/syncdb-local-first.md) (Phase 8) |

## Completed

| Plan | Status | Created | Tasks |
|------|--------|---------|-------|
| [APIError redesign — standards-first extension of Error](apierror-standard-error-redesign.md) | Complete | 2026-07-28 | n/a |

## Deferred / Closed

*(Plans parked or superseded.)*

## Backlog

*(Links to ideas not yet promoted to a full IP.)*

| Idea | Notes |
|------|-------|
| [Langfuse integration](terreno-langfuse-integration.md) | AI observability plugin |
| [modelRouter MCP tools](model-router-mcp.md) | MCP surface for consumer app APIs |
| [Offline mode](offline-mode.md) | Superseded in large part by [syncdb](syncdb-local-first.md) — confirm and close |
| [modelRouter actions](model-router-actions.md) | — |
