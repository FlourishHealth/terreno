APIError is a simple way to throw an error in an API route and control what is shown and the
HTTP code displayed. It follows the JSONAPI spec to standardize the fields,
allowing the UI to show more consistent, better error messages.

```ts
 throw new APIError({
   title: "Only an admin can update that!",
   status: 403,
   code: "update-admin-error",
   detail: "You must be an admin to change that field"
 });
```

## Extends

- `Error`

## Constructors

### Constructor

> **new APIError**(`data`): `APIError`

#### Parameters

##### data

[`APIErrorConstructor`](../interfaces/APIErrorConstructor.md)

#### Returns

`APIError`

#### Overrides

`Error.constructor`

## Properties

### code

> **code**: `string` \| `undefined`

***

### detail

> **detail**: `string` \| `undefined`

***

### disableExternalErrorTracking?

> `optional` **disableExternalErrorTracking?**: `boolean`

***

### error?

> `optional` **error?**: `unknown`

***

### id

> **id**: `string` \| `undefined`

***

### links

> **links**: \{ `about?`: `string`; `type?`: `string`; \} \| `undefined`

***

### meta

> **meta**: \{\[`id`: `string`\]: `unknown`; \} \| `undefined`

***

### source

> **source**: \{ `header?`: `string`; `parameter?`: `string`; `pointer?`: `string`; \} \| `undefined`

***

### status

> **status**: `number`

***

### title

> **title**: `string`
