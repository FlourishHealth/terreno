# Add a model to the admin

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

Common fields:

- `listFields`: columns and fields exposed to admin CRUD.
- `searchFields`: fields searched by the list search box.
- `sortableFields`: the only columns with sorting enabled.
- `filters`: typed filter drawer controls.
- `fieldsets`: grouped form sections.
- `readonlyFields` / `hiddenFields`: display-only or omitted form fields.
- `adminPermissions`: optional admin-specific permission methods.
