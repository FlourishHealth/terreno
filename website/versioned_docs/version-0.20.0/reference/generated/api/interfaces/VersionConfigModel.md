## Extends

- `Model`\<[`VersionConfigDocument`](VersionConfigDocument.md)\>

## Constructors

### Constructor

> **new VersionConfigModel**\<`DocType`\>(`doc?`, `fields?`, `options?`): `Document`\<`unknown`, \{ \}, [`VersionConfigDocument`](VersionConfigDocument.md), \{ \}, \{ \}\> & [`VersionConfigDocument`](VersionConfigDocument.md) & `Required`\<\{ \}\> & `object`

#### Parameters

##### doc?

`DocType`

##### fields?

`any`

##### options?

`boolean` \| `AnyObject`

#### Returns

`Document`\<`unknown`, \{ \}, [`VersionConfigDocument`](VersionConfigDocument.md), \{ \}, \{ \}\> & [`VersionConfigDocument`](VersionConfigDocument.md) & `Required`\<\{ \}\> & `object`

#### Inherited from

`mongoose.Model<VersionConfigDocument>.constructor`

## Methods

### findOneOrNone()

> **findOneOrNone**(`query`, `errorArgs?`): `Promise`\<`Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\> & [`VersionConfigDocument`](VersionConfigDocument.md) \| `null`\>

#### Parameters

##### query

`Record`\<`string`, `unknown`\>

##### errorArgs?

`Partial`\<[`APIErrorConstructor`](APIErrorConstructor.md)\>

#### Returns

`Promise`\<`Document`\<`ObjectId`, `any`, `any`, `Record`\<`string`, `any`\>, \{ \}\> & [`VersionConfigDocument`](VersionConfigDocument.md) \| `null`\>
