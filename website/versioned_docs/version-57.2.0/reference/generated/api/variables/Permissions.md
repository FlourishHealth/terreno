> `const` **Permissions**: `object`

## Type Declaration

### IsAdmin

> **IsAdmin**: (`_method`, `user?`) => `boolean`

#### Parameters

##### \_method

[`RESTMethod`](../type-aliases/RESTMethod.md)

##### user?

[`User`](../interfaces/User.md)

#### Returns

`boolean`

### IsAny

> **IsAny**: () => `boolean`

#### Returns

`boolean`

### IsAuthenticated

> **IsAuthenticated**: (`_method`, `user?`) => `boolean`

#### Parameters

##### \_method

[`RESTMethod`](../type-aliases/RESTMethod.md)

##### user?

[`User`](../interfaces/User.md)

#### Returns

`boolean`

### IsAuthenticatedOrReadOnly

> **IsAuthenticatedOrReadOnly**: (`method`, `user?`) => `boolean`

#### Parameters

##### method

[`RESTMethod`](../type-aliases/RESTMethod.md)

##### user?

[`User`](../interfaces/User.md)

#### Returns

`boolean`

### IsOrganizationMember

> **IsOrganizationMember**: (`_method`, `user?`, `obj?`) => `boolean`

Object-level permission for tenant-scoped documents: the caller must belong to the document's
organization (admins always pass). With no object (list/create checks) it returns true and
defers to the [OrganizationQueryFilter](../functions/OrganizationQueryFilter.md) / a `preCreate` hook to scope access. Expects the
document to expose an `organizationId` and the user an `organizationIds` array.

#### Parameters

##### \_method

[`RESTMethod`](../type-aliases/RESTMethod.md)

##### user?

[`User`](../interfaces/User.md)

##### obj?

`unknown`

#### Returns

`boolean`

### IsOwner

> **IsOwner**: (`_method`, `user?`, `obj?`) => `boolean`

#### Parameters

##### \_method

[`RESTMethod`](../type-aliases/RESTMethod.md)

##### user?

[`User`](../interfaces/User.md)

##### obj?

`unknown`

#### Returns

`boolean`

### IsOwnerOrReadOnly

> **IsOwnerOrReadOnly**: (`method`, `user?`, `obj?`) => `boolean`

#### Parameters

##### method

[`RESTMethod`](../type-aliases/RESTMethod.md)

##### user?

[`User`](../interfaces/User.md)

##### obj?

`unknown`

#### Returns

`boolean`
