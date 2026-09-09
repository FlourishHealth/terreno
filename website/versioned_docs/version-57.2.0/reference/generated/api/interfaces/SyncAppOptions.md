Options for the SyncApp plugin's HTTP routes.

## Properties

### defaultSnapshotLimit?

> `optional` **defaultSnapshotLimit?**: `number`

Default page size for snapshots (default 100, max 100).

***

### getUserScopes?

> `optional` **getUserScopes?**: (`user`, `entry`) => `string`[] \| `Promise`\<`string`[]\>

Resolve the scope values a user belongs to for tenant-scoped models
(e.g. the user's organization ids). Required when any registered model uses a
tenant scope.

#### Parameters

##### user

[`User`](User.md)

##### entry

[`SyncRegistryEntry`](SyncRegistryEntry.md)

#### Returns

`string`[] \| `Promise`\<`string`[]\>
