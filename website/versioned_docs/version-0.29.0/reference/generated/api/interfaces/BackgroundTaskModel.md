## Extends

- `Model`\<[`BackgroundTaskDocument`](BackgroundTaskDocument.md), `Record`\<`string`, `never`\>, [`BackgroundTaskMethods`](BackgroundTaskMethods.md)\>.[`BackgroundTaskStatics`](BackgroundTaskStatics.md)

## Constructors

### Constructor

> **new BackgroundTaskModel**\<`DocType`\>(`doc?`, `fields?`, `options?`): `Document`\<`unknown`, `Record`\<`string`, `never`\>, [`BackgroundTaskDocument`](BackgroundTaskDocument.md), \{ \}, \{ \}\> & `Omit`\<[`BackgroundTaskDocument`](BackgroundTaskDocument.md) & `Required`\<\{ \}\> & `object`, keyof [`BackgroundTaskMethods`](BackgroundTaskMethods.md)\> & [`BackgroundTaskMethods`](BackgroundTaskMethods.md)

#### Parameters

##### doc?

`DocType`

##### fields?

`any`

##### options?

`boolean` \| `AnyObject`

#### Returns

`Document`\<`unknown`, `Record`\<`string`, `never`\>, [`BackgroundTaskDocument`](BackgroundTaskDocument.md), \{ \}, \{ \}\> & `Omit`\<[`BackgroundTaskDocument`](BackgroundTaskDocument.md) & `Required`\<\{ \}\> & `object`, keyof [`BackgroundTaskMethods`](BackgroundTaskMethods.md)\> & [`BackgroundTaskMethods`](BackgroundTaskMethods.md)

#### Inherited from

`Model<BackgroundTaskDocument, Record<string, never>, BackgroundTaskMethods>.constructor`

## Properties

### checkCancellation

> **checkCancellation**: (`taskId`) => `Promise`\<`void`\>

#### Parameters

##### taskId

`string`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`BackgroundTaskStatics`](BackgroundTaskStatics.md).[`checkCancellation`](BackgroundTaskStatics.md#checkcancellation)
