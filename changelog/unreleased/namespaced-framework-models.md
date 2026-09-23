---
category: Fixed
---

Framework Mongoose models added in 57.3 and 57.4 now use `Terreno*` model names
without changing their MongoDB collections, preventing collisions with consumer
models such as `Notification`, `Membership`, and `Job`. JWT recovery routes can
be disabled with `authOptions.passwordReset`, `emailVerification`, and
`legacyResetPasswordRoute`.
