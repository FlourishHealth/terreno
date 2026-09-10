# In-app notification center

## Added

- `NotificationsApp` in `@terreno/api` — owner-scoped `Notification` and `NotificationPreference`
  models, `getNotificationService().notify()`, `notificationsBeforeSend`, mark-all-read, and
  optional `retainDays` tombstone sweep
- `@terreno/ui` — `NotificationBell`, `NotificationInbox`, `NotificationPreferences` (presentational)
- Example app — syncdb collections, todos header bell, settings preferences screen, dev notify route
- Docs — `docs/how-to/in-app-notifications.md`, reference updates for api/ui/comms
- `terreno-syncdb-codegen` — hyphenated sync collection names (e.g. `notification-preferences`)

## Notes

- Inbox rows are synced collections; use syncdb hooks, not new RTK CRUD hooks
- `NotificationInbox` is list-only; the host wraps it in `Modal` or a sheet
