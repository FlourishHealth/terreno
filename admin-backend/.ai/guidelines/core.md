## Admin panel backend

Read the architecture first:

- `docs/explanation/admin-interface.md`
- `docs/how-to/admin-add-model.md`
- `docs/how-to/build-admin-screens.md`

Put `admin` on `modelRouter`. Use plugin `adminContribution()` for plugin-owned
models and screens. `AdminApp.customScreens` `name` must match the frontend widget
key. `admin:access` opens `/admin/config`; model CRUD is not a substitute.

Agent workflow: skill `building-admin-interfaces`.
