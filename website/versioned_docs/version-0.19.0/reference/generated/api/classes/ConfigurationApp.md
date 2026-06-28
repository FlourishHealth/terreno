TerrenoPlugin that provides configuration management endpoints.

Inspects the Mongoose configuration model to auto-generate:
- `GET {basePath}/meta` — Schema metadata (sections, fields, types, descriptions)
- `GET {basePath}` — Current configuration values
- `PATCH {basePath}` — Update configuration values
- `POST {basePath}/refresh-secrets` — Trigger secret refresh (if provider configured)

All endpoints require `Permissions.IsAdmin`.

Nested subschemas in the model become separate sections in the metadata,
making them renderable as cards/accordions in the admin UI.

## Example

```typescript
import {ConfigurationApp, configurationPlugin} from "@terreno/api";

const configSchema = new Schema({
  general: { type: new Schema({
    appName: { type: String, description: "App display name", default: "My App" },
    maintenanceMode: { type: Boolean, description: "Enable maintenance mode", default: false },
  })},
  integrations: { type: new Schema({
    openAiKey: { type: String, description: "OpenAI API key", secret: true, secretName: "openai-key" },
  })},
});
configSchema.plugin(configurationPlugin);
const AppConfig = mongoose.model("AppConfig", configSchema);

new TerrenoApp({ userModel: User })
  .configure(AppConfig)
  .start();
```

## Implements

- [`TerrenoPlugin`](../interfaces/TerrenoPlugin.md)

## Constructors

### Constructor

> **new ConfigurationApp**(`options`): `ConfigurationApp`

#### Parameters

##### options

[`ConfigurationAppOptions`](../interfaces/ConfigurationAppOptions.md)

#### Returns

`ConfigurationApp`

## Methods

### register()

> **register**(`app`): `void`

Register routes and middleware with the Express application.

Called during `TerrenoApp.build()` after core middleware has been
configured but before error handling middleware is added.

#### Parameters

##### app

`Application`

The Express application instance to register with

#### Returns

`void`

#### Implementation of

[`TerrenoPlugin`](../interfaces/TerrenoPlugin.md).[`register`](../interfaces/TerrenoPlugin.md#register)
