---
category: Fixed
---

RBAC permission resolution now keys the in-memory grant cache by user id and
sorted role names, so promoting a user (for example e2e `setUserAdmin`) takes
effect on the next `/auth/me` instead of serving a 30s stale set.
