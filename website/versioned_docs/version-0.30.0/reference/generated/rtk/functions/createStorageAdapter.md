> **createStorageAdapter**(`isWeb?`): [`StorageAdapter`](../interfaces/StorageAdapter.md)

Async storage adapter for Better Auth that works on both web and native.
Uses SecureStore on native platforms and AsyncStorage on web.

`isWeb` is exposed as a parameter so the adapter can be unit tested
without having to re-load the module for each platform.

## Parameters

### isWeb?

`boolean` = `IsWeb`

## Returns

[`StorageAdapter`](../interfaces/StorageAdapter.md)
