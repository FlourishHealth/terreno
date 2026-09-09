> **ensureSyncIndexes**(): `Promise`\<`void`\>

C8: await every enqueued sync index creation — per-model snapshot indexes from
`registerSync` plus the bookkeeping-model indexes from `SyncApp.register` — throwing on
the first failure. Called at server startup by `TerrenoApp.start()` (after all models
and plugins register) so a missing index fails the boot loudly rather than silently
degrading the snapshot query to a table scan or breaking mutation idempotency.

## Returns

`Promise`\<`void`\>
