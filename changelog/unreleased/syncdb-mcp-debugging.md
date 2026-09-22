---
category: Added
---

Add full SyncDB support to `terreno-mcp-local`: inspect debugger and local-store
state, capture/compare/merge snapshots, mutate or directly edit local entities,
flush the outbox, reconcile/resync, resolve conflicts, retry failures, and
exercise offline transitions. State-changing operations require
`TERRENO_MCP_EVAL=1`; returned state redacts sensitive fields.
