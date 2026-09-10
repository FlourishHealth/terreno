---
category: Added
---

- **@terreno/ui `DataTable`**: optional server-side search and column filters emit
  modelRouter-shaped query params via `onQueryChange` and `buildDataTableListQuery`
  (web per-column `Filter` popovers; native Filters sheet).
- **@terreno/admin-frontend `AdminModelTable`**: adopts DataTable filter/search UI;
  list search still uses `q`; choice filters support multi-value `$in`.
- **@terreno/admin-backend**: `parseAdminListFilters` accepts choice `{$in: string[]}`
  and text `{$regex, $options: "i"}`.
