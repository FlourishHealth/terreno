## Extends

- `Model`\<[`User`](User.md)\>

## Constructors

### Constructor

> **new UserModel**\<`DocType`\>(`doc?`, `fields?`, `options?`): `Document`\<`unknown`, \{ \}, [`User`](User.md), \{ \}, \{ \}\> & [`User`](User.md) & `Required`\<\{ \}\> & `object`

#### Parameters

##### doc?

`DocType`

##### fields?

`any`

##### options?

`boolean` \| `AnyObject`

#### Returns

`Document`\<`unknown`, \{ \}, [`User`](User.md), \{ \}, \{ \}\> & [`User`](User.md) & `Required`\<\{ \}\> & `object`

#### Inherited from

`Model<User>.constructor`

## Properties

### createAnonymousUser?

> `optional` **createAnonymousUser?**: (`id?`) => `Promise`\<[`User`](User.md)\>

#### Parameters

##### id?

`string`

#### Returns

`Promise`\<[`User`](User.md)\>

***

### postCreate?

> `optional` **postCreate?**: (`body`) => `Promise`\<`void`\>

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

## Methods

### createStrategy()

> **createStrategy**(): `any`

#### Returns

`any`

***

### deserializeUser()

> **deserializeUser**(): `any`

#### Returns

`any`

***

### findByUsername()

> **findByUsername**(`username`, `findOpts`): `any`

#### Parameters

##### username

`string`

##### findOpts

`any`

#### Returns

`any`

***

### serializeUser()

> **serializeUser**(): `any`

#### Returns

`any`
