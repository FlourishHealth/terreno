## Admin Panel Frontend

The frontend uses `@terreno/admin-frontend` components for the admin panel:

- `AdminModelList` — entry screen listing all admin models
- `AdminModelTable` — table view for a model with pagination
- `AdminModelForm` — create/edit form (auto-generated from schema)
- `ConfigurationScreen` — admin configuration editor

Admin screens live in `app/(tabs)/admin/`. The panel reads metadata from `GET /admin/config`.
