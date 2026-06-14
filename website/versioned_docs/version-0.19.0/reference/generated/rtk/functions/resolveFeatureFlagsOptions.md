> **resolveFeatureFlagsOptions**(`basePathOrOptions?`): `ResolvedFeatureFlagsOptions`

Normalizes the legacy-compatible `basePathOrOptions` argument into a
`{basePath, skip}` pair with defaults applied.

- `undefined` -> `{basePath: "/feature-flags", skip: false}`
- `string`    -> `{basePath: <string>, skip: false}` (legacy form)
- `object`    -> `{basePath: opts.basePath ?? "/feature-flags", skip: opts.skip ?? false}`

## Parameters

### basePathOrOptions?

`string` \| [`UseFeatureFlagsOptions`](../interfaces/UseFeatureFlagsOptions.md)

## Returns

`ResolvedFeatureFlagsOptions`
