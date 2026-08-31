> **warnOnSyncScopesWithoutUserModel**(`__namedParameters`): `string`[]

Task 9.21: warn loudly at startup when a tenant/custom-scoped collection is registered
but no `userModel` is configured for socket handshakes.

Without one, `getSocketUser` falls back to the synthetic decoded-token user: `admin`
comes from a JWT claim rather than the database, and `getUserScopes` sees no
`organizationIds`, so tenant subscriptions silently resolve to no streams (a client that
appears connected but never receives data). This warns rather than throws so an existing
deployment cannot be bricked by an upgrade; the message names the collections and the
fix. Returns the offending collection tags for tests and callers that want to escalate.

## Parameters

### \_\_namedParameters

#### userModel?

`unknown`

## Returns

`string`[]
