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

> **options**: [`ModelRouterOptions`](ModelRouterOptions.md)\<`unknown`\>

Full modelRouter options (for responseHandler, permissions, etc.), erased to
`unknown` since the registry holds entries for every model.

***

### routePath

> **routePath**: `string`

Route path (e.g. "/todos")
