> **OrganizationQueryFilter**(`user?`): \{ `organizationId`: \{ `$in`: `string`[]; \}; \} \| `null`

Restricts list queries to documents belonging to one of the caller's organizations. This is the
tenant-scoped analog of [OwnerQueryFilter](OwnerQueryFilter.md): it filters on the document's `organizationId`
field using the user's `organizationIds`. Returns `null` for anonymous callers (no user).

## Parameters

### user?

[`User`](../interfaces/User.md)

## Returns

\{ `organizationId`: \{ `$in`: `string`[]; \}; \} \| `null`
