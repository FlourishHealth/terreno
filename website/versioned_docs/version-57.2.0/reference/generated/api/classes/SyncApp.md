TerrenoPlugin mounting the SyncDB local-first sync HTTP routes
(`GET /sync/snapshot`, `POST /sync/mutate`, `GET /sync/key`). Models opt in via
modelRouter's `sync` option; this plugin serves the registered collections.

Registration attaches the plugin's options (notably `getUserScopes`) to this Express
application so RealtimeApp's connection handler can install the socket
mutation/subscription channel (`sync:subscribe`, `sync:mutate`) with the same
configuration — the socket layer requires both plugins: SyncApp for config/routes and
RealtimeApp for the Socket.io server and `sync:delta` emission.

Registration also kicks off the bookkeeping-model index builds (`SyncCounter`,
`SyncMutation`, `SyncScopeMove`, `SyncKey`) and enqueues them for `ensureSyncIndexes()`,
which `TerrenoApp.start()` awaits before listening. Those indexes are correctness
requirements — the unique `mutationId` index is what makes duplicate mutation deliveries
idempotent, and the unique `stream` index is what keeps the counter upsert race from
minting duplicate seqs — so an index-build failure fails startup loudly. Apps that build
the Express app without `TerrenoApp.start()` should await `ensureSyncIndexes()` themselves.

## Implements

- [`TerrenoPlugin`](../interfaces/TerrenoPlugin.md)

## Constructors

### Constructor

> **new SyncApp**(`options?`): `SyncApp`

#### Parameters

##### options?

[`SyncAppOptions`](../interfaces/SyncAppOptions.md) = `{}`

#### Returns

`SyncApp`

## Methods

### register()

> **register**(`app`): `void`

Register routes and middleware with the Express application.

Called during `TerrenoApp.build()` after core middleware has been
configured but before error handling middleware is added.

#### Parameters

##### app

`Application`

The Express application instance to register with

#### Returns

`void`

#### Implementation of

[`TerrenoPlugin`](../interfaces/TerrenoPlugin.md).[`register`](../interfaces/TerrenoPlugin.md#register)
