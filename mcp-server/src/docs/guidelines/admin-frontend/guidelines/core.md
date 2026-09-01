## Admin panel frontend

Read the architecture first:

- `docs/explanation/admin-interface.md`
- `docs/how-to/build-admin-screens.md`

Use `AdminProvider` + `AdminShellLayout`. Home is `AdminHome`. Generic models use
`AdminScreenRouter` on `[model]/index` (create is `[model]/create`, not `new`).
Custom screens need the same `name` on `AdminApp.customScreens` and
`widgets.screens`. Admin HTTP uses `useAdminConfig` / `useAdminApi` (not syncdb).

Agent workflow: skill `building-admin-interfaces`.
