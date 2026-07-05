Configuration options for Better Auth integration.

## Properties

### appleOAuth?

> `optional` **appleOAuth?**: [`BetterAuthOAuthProvider`](BetterAuthOAuthProvider.md)

Apple OAuth provider configuration.

***

### basePath?

> `optional` **basePath?**: `string`

Base path for Better Auth routes.

#### Default

```ts
"/api/auth"
```

***

### baseURL?

> `optional` **baseURL?**: `string`

Base URL for the auth server.
If not provided, falls back to BETTER_AUTH_URL environment variable.

***

### enabled

> **enabled**: `boolean`

Whether Better Auth is enabled for this server.

***

### githubOAuth?

> `optional` **githubOAuth?**: [`BetterAuthOAuthProvider`](BetterAuthOAuthProvider.md)

GitHub OAuth provider configuration.

***

### googleOAuth?

> `optional` **googleOAuth?**: [`BetterAuthOAuthProvider`](BetterAuthOAuthProvider.md)

Google OAuth provider configuration.

***

### secret?

> `optional` **secret?**: `string`

Secret key for Better Auth session encryption.
If not provided, falls back to BETTER_AUTH_SECRET environment variable.

***

### trustedOrigins?

> `optional` **trustedOrigins?**: `string`[]

Trusted origins for CORS and redirect validation.
Include your app's deep link schemes (e.g., "terreno://", "exp://").
