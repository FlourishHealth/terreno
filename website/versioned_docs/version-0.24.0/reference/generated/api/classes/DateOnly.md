## Extends

- `SchemaType`

## Constructors

### Constructor

> **new DateOnly**(`key`, `options`): `DateOnly`

#### Parameters

##### key

`string`

##### options

`SchemaTypeOptions`\<`Date`\>

#### Returns

`DateOnly`

#### Overrides

`SchemaType.constructor`

## Properties

### $conditionalHandlers

> **$conditionalHandlers**: `any`

Contains the handlers for different query operators for this schema type.

#### Overrides

`SchemaType.$conditionalHandlers`

## Methods

### cast()

> **cast**(`val`): `Date` \| `undefined`

Cast `val` to this schema type. Each class that inherits from schema type should implement this function.

#### Parameters

##### val

`unknown`

#### Returns

`Date` \| `undefined`

#### Overrides

`SchemaType.cast`

***

### castForQuery()

> **castForQuery**(`$conditional`, `val`, `context`): `Date` \| `undefined`

#### Parameters

##### $conditional

`string` \| `undefined`

##### val

`unknown`

##### context

`unknown`

#### Returns

`Date` \| `undefined`

***

### get()

> **get**(`val`): `this`

Adds a getter to this schematype.

#### Parameters

##### val

`unknown`

#### Returns

`this`

#### Overrides

`SchemaType.get`

***

### handleSingle()

> **handleSingle**(`val`): `Date` \| `undefined`

#### Parameters

##### val

`unknown`

#### Returns

`Date` \| `undefined`
