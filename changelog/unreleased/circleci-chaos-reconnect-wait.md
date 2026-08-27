---
category: Fixed
---

CircleCI Playwright chaos e2e no longer force-restarts the sync client after
flaps. `goOnline` waiting for the Offline banner to hide is the reconnect
signal; `client.stop()` hung for 30s on the production static export.
