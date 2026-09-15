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
  Optional choice filters auto-enable an **Empty** option (`__empty__` wire sentinel → Mongo
  `null`) when the Mongoose field is not required; explicit `allowEmpty` overrides.
- **@terreno/api**: OpenAPI query validation accepts choice scalars, `{$in: [...]}`, and
  the empty sentinel alongside enum values.
- **@terreno/ui `buildDataTableListQuery`**: single concrete choice values emit scalar
  equality (validator-friendly); empty-only and empty+concrete use `$in` with `__empty__`.
- **@terreno/ui `Filter`**: new `iconOnly` and `triggerSize` props render a compact
  icon trigger for dense chrome; DataTable column headers use it.
- **@terreno/ui `DataTable`**: single-column filter popovers no longer duplicate the
  popover's own Clear with a per-field **Clear filter**; the boolean per-field clear
  now appears only where one surface hosts several filters.
