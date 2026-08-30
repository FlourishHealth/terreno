---
category: Added
---

Opt-in HTTP rate limiting on `TerrenoApp` via `rateLimit: {}` (memory default; `redis` or `mongo` for shared buckets). Login and related auth routes use 20 requests / 15 minutes; other framework HTTP uses 600 / 15 minutes. Omitted `rateLimit` is a no-op until Terreno 58. 429 is `APIError` `code: "rate-limit-exceeded"`. See `docs/how-to/rate-limiting.md`.
