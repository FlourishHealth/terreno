A registered model with SyncDB local-first sync configuration.

## Properties

### collectionName

> **collectionName**: `string`

MongoDB collection name (e.g. "todos")

***

### collectionTag

> **collectionTag**: `string`

Collection tag used in the sync protocol (route path without the leading slash)

***

### config

> **config**: [`SyncConfig`](SyncConfig.md)

Sync configuration from modelRouter options

***

### modelName

> **modelName**: `string`

Mongoose model name (e.g. "Todo")

***

### options

> **options**: [`ModelRouterOptions`](ModelRouterOptions.md)\<`unknown`\>

Full modelRouter options (for responseHandler, permissions, etc.)

***

### routePath

> **routePath**: `string`

Route path (e.g. "/todos")
