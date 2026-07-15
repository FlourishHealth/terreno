## Extends

- `BaseActionConfig`\<`TBody`, `TQuery`, `TResponse`\>

## Type Parameters

### TDoc

`TDoc`

### TBody

`TBody`

### TQuery

`TQuery`

### TResponse

`TResponse`

## Properties

### body?

> `optional` **body?**: `ZodType`\<`TBody`, `unknown`, `$ZodTypeInternals`\<`TBody`, `unknown`\>\>

#### Inherited from

`BaseActionConfig.body`

***

### description?

> `optional` **description?**: `string`

#### Inherited from

`BaseActionConfig.description`

***

### handler

> **handler**: (`ctx`) => `TResponse` \| `Promise`\<`TResponse`\>

#### Parameters

##### ctx

[`ActionContext`](ActionContext.md)\<`TDoc`, `TBody`, `TQuery`\>

#### Returns

`TResponse` \| `Promise`\<`TResponse`\>

***

### method

> **method**: `"GET"` \| `"POST"`

#### Inherited from

`BaseActionConfig.method`

***

### permissions

> **permissions**: [`PermissionMethod`](../type-aliases/PermissionMethod.md)\<`unknown`\>[]

#### Inherited from

`BaseActionConfig.permissions`

***

### query?

> `optional` **query?**: `ZodType`\<`TQuery`, `unknown`, `$ZodTypeInternals`\<`TQuery`, `unknown`\>\>

#### Inherited from

`BaseActionConfig.query`

***

### response?

> `optional` **response?**: `ZodType`\<`TResponse`, `unknown`, `$ZodTypeInternals`\<`TResponse`, `unknown`\>\>

#### Inherited from

`BaseActionConfig.response`

***

### status?

> `optional` **status?**: `number`

#### Inherited from

`BaseActionConfig.status`

***

### summary?

> `optional` **summary?**: `string`

#### Inherited from

`BaseActionConfig.summary`

***

### tag?

> `optional` **tag?**: `string`

#### Inherited from

`BaseActionConfig.tag`
