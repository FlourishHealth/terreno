## Properties

### addMiddleware?

> `optional` **addMiddleware?**: [`AddRoutes`](../type-aliases/AddRoutes.md)

***

### addRoutes

> **addRoutes**: [`AddRoutes`](../type-aliases/AddRoutes.md)

***

### authOptions?

> `optional` **authOptions?**: [`AuthOptions`](AuthOptions.md)

***

### corsOrigin?

> `optional` **corsOrigin?**: `string` \| `boolean` \| `RegExp` \| (`string` \| `boolean` \| `RegExp`)[] \| ((`requestOrigin`, `callback`) => `void`)

***

### githubAuth?

> `optional` **githubAuth?**: [`GitHubAuthOptions`](GitHubAuthOptions.md)

GitHub OAuth configuration. When provided, enables GitHub authentication.
Requires the user schema to have GitHub fields (use githubUserPlugin).

***

### ignoreTraces?

> `optional` **ignoreTraces?**: `string`[]

***

### loggingOptions?

> `optional` **loggingOptions?**: [`LoggingOptions`](LoggingOptions.md)

***

### logRequests?

> `optional` **logRequests?**: `boolean`

***

### sentryOptions?

> `optional` **sentryOptions?**: `BunOptions`

***

### skipListen?

> `optional` **skipListen?**: `boolean`

***

### userModel

> **userModel**: [`UserModel`](UserModel.md)
