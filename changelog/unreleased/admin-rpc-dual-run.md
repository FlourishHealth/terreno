---
category: Changed
---

Admin RPC hooks dual-run: hosts that inject `credentials` / `getAuthHeaders` on `AdminProvider` use native `adminRequest`; hosts that pass only `api` keep RTK `injectEndpoints`.
