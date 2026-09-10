---
category: Added
---

`GET /admin/config` model meta includes `adminBroadcast` (always) and `syncCollection` when the app sync registry has `adminBroadcast: true`. `AdminProvider` accepts optional `syncDb`. `AdminModelTable` then uses REST membership + TinyBase overlay with a visible Refresh control; hosts that pass only `api` keep the RTK list.
