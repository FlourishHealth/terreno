---
category: Added
---

Example app profiles list every assigned role and link superadmins to role editing. The admin
script runner includes a guarded `resetDatabase` action, and seed data includes
`superuser@example.com`. Admin script execution requires `admin:runScripts` when RBAC is
configured, and live production resets require `ALLOW_ADMIN_DB_RESET=true`.
