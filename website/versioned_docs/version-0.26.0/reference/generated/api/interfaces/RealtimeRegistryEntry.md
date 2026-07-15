A registered model with real-time sync configuration.

## Properties

### collectionName

> **collectionName**: `string`

Collection name in MongoDB (e.g. "todos")

***

### config

> **config**: [`RealtimeConfig`](RealtimeConfig.md)

Real-time configuration from modelRouter options

***

### modelName

> **modelName**: `string`

Mongoose model name (e.g. "Todo")

***

### options

> **options**: [`ModelRouterOptions`](ModelRouterOptions.md)\<`any`\>

Full modelRouter options (for responseHandler, permissions, etc.).

***

### routePath

> **routePath**: `string`

Route path (e.g. "/todos")
