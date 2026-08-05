> **createBetterAuthClient**(`config`): `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object`

Creates a Better Auth client configured for Expo/React Native.

## Parameters

### config

[`BetterAuthClientConfig`](../interfaces/BetterAuthClientConfig.md)

## Returns

`object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object` & `object`

## Example

```typescript
const authClient = createBetterAuthClient({
  baseURL: "http://localhost:3000",
  scheme: "terreno",
});

// Use for social login
await authClient.signIn.social({
  provider: "google",
});

// Get current session
const session = await authClient.getSession();
```
