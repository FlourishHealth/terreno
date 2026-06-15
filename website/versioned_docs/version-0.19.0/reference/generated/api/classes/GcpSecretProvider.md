Secret provider that reads secrets from Google Cloud Secret Manager.

Requires `@google-cloud/secret-manager` to be installed.
Resolves short names like "openai-api-key" to the full resource path
`projects/{projectId}/secrets/{secretName}/versions/latest`.

## Example

```typescript
const provider = new GcpSecretProvider({ projectId: "my-project" });
const key = await provider.getSecret("openai-api-key");
```

## Implements

- [`SecretProvider`](../interfaces/SecretProvider.md)

## Constructors

### Constructor

> **new GcpSecretProvider**(`options`): `GcpSecretProvider`

#### Parameters

##### options

[`GcpSecretProviderOptions`](../interfaces/GcpSecretProviderOptions.md)

#### Returns

`GcpSecretProvider`

## Properties

### name

> **name**: `string` = `"gcp"`

#### Implementation of

[`SecretProvider`](../interfaces/SecretProvider.md).[`name`](../interfaces/SecretProvider.md#name)

## Methods

### getSecret()

> **getSecret**(`secretName`): `Promise`\<`string` \| `null`\>

#### Parameters

##### secretName

`string`

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`SecretProvider`](../interfaces/SecretProvider.md).[`getSecret`](../interfaces/SecretProvider.md#getsecret)
