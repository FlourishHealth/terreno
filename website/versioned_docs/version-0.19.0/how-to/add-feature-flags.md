# Add Feature Flags

Add feature flags and A/B testing to your Terreno app using `@terreno/feature-flags`.

## Prerequisites

- A working Terreno backend using `TerrenoApp`
- `@terreno/admin-backend` registered for the admin panel (optional but recommended)

## Steps

### 1. Install the package

```bash
bun add @terreno/feature-flags
```

### 2. Register the backend plugin

In your server file, register `FeatureFlagsApp` and add the admin config:

```typescript
import {TerrenoApp} from "@terreno/api";
import {AdminApp} from "@terreno/admin-backend";
import {FeatureFlagsApp, featureFlagAdminConfig} from "@terreno/feature-flags";

// Define segment functions to classify users for targeting rules
const segments = {
  "pro-users": (user) => user.plan === "pro",
  "beta-testers": (user) => user.betaTester === true,
  "internal-team": (user) => user.email?.endsWith("@mycompany.com"),
};

new TerrenoApp({userModel: User})
  .register(new FeatureFlagsApp({segments}))
  .register(
    new AdminApp({
      models: [
        featureFlagAdminConfig,  // adds Feature Flags to the admin panel
        // ...your other models
      ],
    })
  )
  .start();
```

`featureFlagAdminConfig` is a pre-configured admin model config exported by the package. It sets up the display name, list fields, route path, and model reference so you don't need to configure them manually.

### 3. Regenerate the frontend SDK

After adding the backend routes, regenerate the SDK so the frontend can call the new endpoints:

```bash
cd your-frontend && bun run sdk
```

### 4. Use feature flags in the frontend

Use the `useFeatureFlags` hook from `@terreno/rtk`:

```typescript
import {useFeatureFlags} from "@terreno/rtk";
import {terrenoApi} from "@/store/sdk";

const MyComponent = () => {
  const {getFlag, isLoading} = useFeatureFlags(terrenoApi);

  if (isLoading) return <Spinner />;

  const showNewUI = getFlag("new-ui");  // true | false

  return showNewUI ? <NewUI /> : <OldUI />;
};
```

### 5. Create flags via the admin panel

Navigate to the admin panel in your app. The "Feature Flags" card appears automatically. Create a flag with:

- **Key**: unique identifier, e.g. `new-ui`
- **Name**: human-readable label
- **Type**: `boolean` for on/off toggles, `variant` for A/B tests
- **Enabled**: global kill switch
- **Rules**: optional targeting (field-based or segment-based)
- **Rollout Percentage**: gradual rollout for boolean flags (default 100%)

## Next steps

- See the [reference docs](../reference/feature-flags.md) for the full API, targeting rules, and variant flags
- See `example-backend/src/server.ts` for a complete working example
