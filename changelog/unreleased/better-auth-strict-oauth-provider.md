---
category: Fixed
---

Better Auth lazy User create no longer sets `oauthProvider: null` on email/password sign-up, so `strict: "throw"` User schemas without that field get `req.user` on the first authenticated request instead of 401.
