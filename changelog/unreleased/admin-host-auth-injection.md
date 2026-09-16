---
category: Changed
---

`AdminProvider` accepts host-injected `credentials` and `getAuthHeaders` for native `adminRequest`. The admin SPA uses cookie `same-origin` credentials; the example app sends a Bearer token.
