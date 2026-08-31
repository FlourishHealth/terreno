> `const` **PRIVILEGED\_USER\_FIELDS**: readonly \[`"admin"`, `"roles"`, `"organizationIds"`\]

User fields that confer authority. Self-service requests (anonymous signup, `PATCH /me`)
must never set them, or any caller could grant themselves admin or an RBAC role. Elevate
users through the admin API or `access.roles.assign` instead.
