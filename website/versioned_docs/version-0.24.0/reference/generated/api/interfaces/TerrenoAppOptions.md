Configuration options for TerrenoApp.

## Properties

### arrayLimit?

> `optional` **arrayLimit?**: `number`

Maximum number of array items in query parameters (default: 200)

***

### authOptions?

> `optional` **authOptions?**: [`AuthOptions`](AuthOptions.md)

Authentication configuration options

***

### beforeJsonSetup?

> `optional` **beforeJsonSetup?**: (`app`) => `void`

Runs after CORS and before the `addMiddleware` chain and JSON body parsing.
Use to attach early middleware via `app.use(...)` before JSON parsing.

#### Parameters

##### app

`Application`

#### Returns

`void`

***

### configureApp?

> `optional` **configureApp?**: [`AddRoutes`](../type-aliases/AddRoutes.md)

Invoked after registered plugins/model routers and before `/auth/me`.
Receives the Express app and OpenAPI bundle for `modelRouter` / `createOpenApiBuilder` wiring.

***

### corsOrigin?

> `optional` **corsOrigin?**: `CorsOrigin`

CORS origin configuration (default: "*")

***

### githubAuth?

> `optional` **githubAuth?**: [`GitHubAuthOptions`](GitHubAuthOptions.md)

GitHub OAuth configuration (enables GitHub authentication if provided)

***

### loggingOptions?

> `optional` **loggingOptions?**: [`LoggingOptions`](LoggingOptions.md)

Logging configuration options

***

### logRequests?

> `optional` **logRequests?**: `boolean`

Whether to log all incoming requests (default: true)

***

### realtime?

> `optional` **realtime?**: `boolean` \| [`RealtimeAppOptions`](RealtimeAppOptions.md)

Real-time sync configuration. When provided, Socket.io and MongoDB change streams
are set up automatically — no need to register RealtimeApp as a separate plugin.

Set to `true` for defaults, or pass a RealtimeAppOptions object for full control.

***

### sentryOptions?

> `optional` **sentryOptions?**: `BunOptions`

Sentry configuration options

***

### skipListen?

> `optional` **skipListen?**: `boolean`

Skip calling app.listen() in start() method (useful for testing)

***

### userModel

> **userModel**: [`UserModel`](UserModel.md)

Mongoose User model with passport-local-mongoose plugin
