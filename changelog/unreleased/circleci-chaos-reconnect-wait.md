---
category: Fixed
---

CircleCI Playwright chaos e2e waits for the syncdb force-reconnect handshake
and a hidden Offline banner before asserting outbox drain, so production
static-export shards are not still offline when drain is checked.
