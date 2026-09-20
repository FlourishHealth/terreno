---
category: Fixed
---

Conflict resolution with **Keep mine** now preserves the admin-window mutation marker
when cloning a durable outbox row, so its retry retains AdminApp authorization,
protected-field stripping, hooks, and audit handling.
