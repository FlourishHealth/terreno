> **configurationPlugin**(`schema`, `options?`): `void`

Mongoose schema plugin that adds singleton configuration behavior.

Adds:
- Pre-save hook enforcing exactly one document
- `getConfig()` static: fetches or creates the singleton (full doc or keyed value)
- `updateConfig(updates)` static: patches the singleton
- `getSecretFields()` static: returns metadata for fields with `secret: true`
- `resolveSecrets(provider?)` static: fetches secret values, using the plugin provider by default

Mark fields as secrets using schema path options:
```typescript
const configSchema = new Schema({
  apiKey: {
    type: String,
    description: "Third-party API key",
    secret: true,
    secretName: "my-api-key",
  },
});
configSchema.plugin(configurationPlugin, {secretProvider: new EnvSecretProvider()});
```

## Parameters

### schema

`Schema`

### options?

[`ConfigurationPluginOptions`](../interfaces/ConfigurationPluginOptions.md)

## Returns

`void`
