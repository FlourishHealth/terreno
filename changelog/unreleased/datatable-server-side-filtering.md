---
category: Added
---

- **@terreno/ui `DataTable`**: optional server-side search and column filters emit
  modelRouter-shaped query params via `onQueryChange` and `buildDataTableListQuery`
  (web per-column `Filter` popovers; native Filters sheet).
- **@terreno/admin-frontend `AdminModelTable`**: adopts DataTable filter/search UI;
  list search still uses `q`; choice filters support multi-value `$in`.
- **@terreno/admin-backend**: `parseAdminListFilters` accepts choice `{$in: string[]}`
  and escaped-literal text `{$regex, $options: "i"}` while rejecting extra operators.
- **@terreno/ui `Filter`**: new `iconOnly` and `triggerSize` props render a compact
  icon trigger for dense chrome; DataTable column headers use it.
