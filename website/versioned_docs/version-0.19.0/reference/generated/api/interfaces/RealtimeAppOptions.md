Options for the RealtimeApp plugin.

## Properties

### adapter?

> `optional` **adapter?**: `"none"` \| `"redis"`

Socket.io adapter for multi-instance deployments.
- 'none': single-instance mode, no adapter (default)
- 'redis': use Redis adapter (requires redisUrl or VALKEY_URL env var)

For MongoDB adapter or custom adapters, configure the Socket.io instance
directly via getIo() after server creation.

***

### changeStream?

> `optional` **changeStream?**: [`ChangeStreamConfig`](ChangeStreamConfig.md)

Change stream watcher configuration

***

### cors?

> `optional` **cors?**: `object`

CORS configuration for Socket.io

#### methods?

> `optional` **methods?**: `string`[]

#### origin

> **origin**: `string` \| `string`[]

***

### debug?

> `optional` **debug?**: `boolean`

Enable debug logging

***

### redisUrl?

> `optional` **redisUrl?**: `string`

Redis URL for the Redis adapter

***

### tokenSecret?

> `optional` **tokenSecret?**: `string`

JWT secret for socket authentication (default: process.env.TOKEN_SECRET)
