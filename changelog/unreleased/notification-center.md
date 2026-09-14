---
category: Added
---

The in-app notification center adds `NotificationsApp` in `@terreno/api` with
owner-scoped `Notification` and `NotificationPreference`
  models, `getNotificationService().notify()`, `notificationsBeforeSend`, mark-all-read, and
  optional `retainDays` tombstone sweep. `@terreno/ui` provides presentational
`NotificationBell`, `NotificationInbox`, and `NotificationPreferences` components.
The example app demonstrates syncdb collections, a todos-header bell, notification
preferences, and a development notify route. `terreno-syncdb-codegen` now accepts
hyphenated collection names such as `notification-preferences`.
