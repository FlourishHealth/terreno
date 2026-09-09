Configuration for local-first sync on a modelRouter, parallel to `realtime`.
Requires the model schema to use `isDeletedPlugin` (soft delete) and `syncPlugin`
(seq stamping) — validated at registration.

## Properties

### responseHandler?

> `optional` **responseHandler?**: (`doc`, `method`) => `unknown`

Custom serializer for sync payloads (snapshot entities and deltas).
Falls back to the modelRouter responseHandler, then the document's toJSON.

#### Parameters

##### doc

`Record`\<`string`, `unknown`\>

##### method

[`SyncMutationOperation`](../type-aliases/SyncMutationOperation.md)

#### Returns

`unknown`

***

### retentionDays?

> `optional` **retentionDays?**: `number`

C7: tombstone retention window in days (default 90). Tombstones older than this may
be hard-deleted by the `compactTombstones` maintenance script; a client whose cursor
predates the retained floor re-bootstraps (see `oldestRetainedSeq`).

***

### scope

> **scope**: [`SyncScope`](../type-aliases/SyncScope.md)

Which stream a document belongs to. Multi-tenant by default via the tenant scope.

***

### snapshotFilter?

> `optional` **snapshotFilter?**: (`user`) => `Record`\<`string`, `unknown`\> \| `Promise`\<`Record`\<`string`, `unknown`\>\>

Server-side query restricting snapshots to the caller's documents. Derived
automatically for owner scopes ({field: user.id}) and tenant scopes
({field: {$in: getUserScopes(...)}}); REQUIRED for custom resolver scopes, whose
stream function cannot be inverted into a Mongo query.

#### Parameters

##### user

###### id

`string`

#### Returns

`Record`\<`string`, `unknown`\> \| `Promise`\<`Record`\<`string`, `unknown`\>\>
