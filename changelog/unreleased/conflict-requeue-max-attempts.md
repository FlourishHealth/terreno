---
category: Fixed
---

Conflict `requeue` copies per-mutation `maxAttempts` onto the cloned outbox
row so `retries: false` stays fail-fast after keepMine.
