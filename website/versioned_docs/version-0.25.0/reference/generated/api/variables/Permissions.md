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
