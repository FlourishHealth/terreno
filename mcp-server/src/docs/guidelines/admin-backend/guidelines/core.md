## Admin Panel (backend)

The backend uses `@terreno/admin-backend`'s `AdminApp` for auto-generated admin CRUD endpoints.
All admin routes require `IsAdmin` permission and are mounted at `/admin`.
Add models to `AdminApp` in `src/server.ts` to expose them in the admin panel.
