> **trackSyncIndexCreation**(`promise`): `void`

Enqueue an index-creation promise for `ensureSyncIndexes()` to await at startup. Used by
`SyncApp.register` for the bookkeeping-model indexes (`SyncCounter`, `SyncMutation`,
`SyncScopeMove`, `SyncKey`), which are correctness-critical and must not depend on
Mongoose `autoIndex` being enabled.

## Parameters

### promise

`Promise`\<`void`\>

## Returns

`void`
