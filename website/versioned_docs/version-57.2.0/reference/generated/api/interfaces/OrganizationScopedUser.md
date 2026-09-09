A user that may belong to one or more organizations (tenants). Backends that use tenant-scoped
models add an `organizationIds` array to their user model; this interface lets the shared
permission/query-filter helpers read it without every consumer casting by hand.

## Extends

- [`User`](User.md)

## Properties

### \_id

> **\_id**: `string` \| `ObjectId`

#### Inherited from

[`User`](User.md).[`_id`](User.md#_id)

***

### admin

> **admin**: `boolean`

#### Inherited from

[`User`](User.md).[`admin`](User.md#admin)

***

### id

> **id**: `string`

#### Inherited from

[`User`](User.md).[`id`](User.md#id)

***

### isAnonymous?

> `optional` **isAnonymous?**: `boolean`

We support anonymous users, which do not yet have login information.
This can be helpful for pre-signup users.

#### Inherited from

[`User`](User.md).[`isAnonymous`](User.md#isanonymous)

***

### organizationIds?

> `optional` **organizationIds?**: `string`[]
