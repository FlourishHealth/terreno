> **useTerrenoFeatureFlags**(`api`, `options?`): [`UseTerrenoFeatureFlagsResult`](../interfaces/UseTerrenoFeatureFlagsResult.md)

Wires Terreno's bulk `/flagConfiguration` fetch into OpenFeature's
TypedInMemoryProvider for the given domain. Prefer OpenFeature React
hooks (`useBooleanFlagValue`, etc.) as children of `<OpenFeatureProvider>`.

## Parameters

### api

`FlagsApi`

### options?

[`UseTerrenoFeatureFlagsOptions`](../interfaces/UseTerrenoFeatureFlagsOptions.md)

## Returns

[`UseTerrenoFeatureFlagsResult`](../interfaces/UseTerrenoFeatureFlagsResult.md)
