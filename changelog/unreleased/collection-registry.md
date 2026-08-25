---
category: Changed
---

`modelRouter` registers collections in one in-memory catalog keyed by route path. MCP, realtime, and sync read shared `ModelRouterOptions` from that catalog; `replaceCollectionOptions` updates every surface at once. Registry `clear*` helpers clear the whole catalog in tests.
