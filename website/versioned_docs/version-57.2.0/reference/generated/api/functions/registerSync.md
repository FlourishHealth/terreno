> **registerSync**\<`T`\>(`__namedParameters`): `void`

Register a model for local-first sync. Called automatically by modelRouter when the
`sync` option is provided. Validates the schema contract at startup and throws with
an actionable message when it is not met:
- soft delete (`isDeletedPlugin`) is required so deletes remain queryable tombstones;
- `syncPlugin` is required so every write stamps a per-stream `_syncSeq`;
- owner/tenant scope fields must exist on the schema.

## Type Parameters

### T

`T`

## Parameters

### \_\_namedParameters

#### config

[`SyncConfig`](../interfaces/SyncConfig.md)

#### model

`Model`\<`T`\>

#### options

[`ModelRouterOptions`](../interfaces/ModelRouterOptions.md)\<`T`\>

#### routePath

`string`

## Returns

`void`
