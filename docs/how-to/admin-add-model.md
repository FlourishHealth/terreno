# Add a model to the admin

Generic table/form routes are already in the host app. Do not add an Expo file per
model. For screens and nav, see [Build admin screens](build-admin-screens.md).

Add `admin` directly to the model's existing `modelRouter` options:

```ts
export const userRouter = modelRouter("/users", User, {
  admin: {
    displayName: "Users",
    listFields: ["email", "name", "admin", "created"],
    searchFields: ["email", "name"],
    sortableFields: ["email", "name", "created"],
    filters: [{field: "admin", kind: "boolean", label: "Admin user"}],
  },
  permissions: {
    create: [Permissions.IsAdmin],
    delete: [Permissions.IsAdmin],
    list: [Permissions.IsAdmin],
    read: [Permissions.IsAdmin],
    update: [Permissions.IsAdmin],
  },
});
```

Register that router with `TerrenoApp`, then register `AdminApp`. The model appears in
`GET /admin/config` and at `/admin/User` without a duplicate `AdminApp.models` entry.

If the same Mongoose model is mounted at two `routePath`s (different filters or list
columns), `/admin/config` keeps `name` as the model name for the registered entry and
suffixes the others with the route slug (for example `Food-archived-foods`) so each list
is reachable.

Common fields:

- `listFields`: columns and fields exposed to admin CRUD.
- `searchFields`: string fields matched by the list search box (`q`) as a
  case-insensitive partial (`$regex`) query.
- `sortableFields`: the only columns with sorting enabled.
- `filters`: typed filter drawer controls.
- `fieldsets`: grouped form sections.
- `readonlyFields` / `hiddenFields`: display-only or omitted form fields.
- `adminPermissions`: optional admin-specific permission methods.
