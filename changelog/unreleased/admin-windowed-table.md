---
category: Added
---

`GET /admin/config` model meta includes `adminBroadcast` (always) and `syncCollection` when the app sync registry has `adminBroadcast: true`. `AdminProvider` accepts optional `syncDb`. `AdminModelTable` then uses REST membership + a live TinyBase overlay with a visible Refresh control; hosts that pass only `api` keep the RTK list. Refresh treats RTK `refetch` error envelopes as failures, drops in-flight Refresh when list params change, and toasts rejected `hydrateWindow` calls. Fetch-RPC mutations invalidate mounted comms, scripts, and configuration queries just like their RTK counterparts.
