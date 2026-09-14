## Admin panel frontend

Read the architecture first:

- `docs/explanation/admin-interface.md`
- `docs/how-to/build-admin-screens.md`

Use `AdminProvider` + `AdminShellLayout`. Home is `AdminHome`. Generic models use
`AdminScreenRouter` on `[model]/index` (create is `[model]/create`, not `new`).
Custom screens need the same `name` on `AdminApp.customScreens` and
`widgets.screens`. String-`_id` model CRUD uses windowed syncdb when
`adminBroadcast` is enabled. Framework admin RPC uses host-bound
`adminRequest`; ObjectId/API-only compatibility CRUD keeps `useAdminApi` in
Terreno 57. Do not add new admin `injectEndpoints`; Terreno 58 removes that path
and the required `api` prop.

Agent workflow: skill `building-admin-interfaces`.
