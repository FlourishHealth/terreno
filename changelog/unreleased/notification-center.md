---
category: Added
---

The in-app notification center adds `NotificationsApp` in `@terreno/api` with
owner-scoped `Notification` and `NotificationPreference`
  models, `getNotificationService().notify()`, `notificationsBeforeSend`, mark-all-read, and
  optional `retainDays` tombstone sweep. `@terreno/ui` provides presentational
`NotificationBell`, `NotificationInbox`, and `NotificationPreferences` components.
The example app demonstrates syncdb collections, a todos-header bell that toggles a
right-side drawer, a full active and archived history page, notification preferences,
seeded notification examples, todo activity notifications, and a development notify
route. `terreno-syncdb-codegen` now accepts hyphenated collection names such as
`notification-preferences`. Consumers can replace the bell icon and unread bubble with
`NotificationBell` render props while retaining its layout and accessibility behavior.
