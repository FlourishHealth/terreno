---
category: Added
---

`BetterAuthConfig.disableRateLimit` turns off Better Auth's built-in limiter on a throwaway in-process seed instance. Preview container seeds that create several users no longer 429 on the fourth signup when `NODE_ENV=production`.
