Creates feature flag accessors from an RTK Query API instance.

Injects a `GET {basePath}/evaluate` endpoint into the API and returns
accessors for reading flag values. Fetches once on mount and caches via
RTK Query. Both `api` and `basePath` should be stable references.

## Example

```typescript
const { getFlag, getVariant } = useFeatureFlags(terrenoApi);

const showNewCheckout = getFlag("new-checkout-flow");       // true | false
const variant = getVariant("checkout-experiment");           // "control" | "variant-a" | null
```

## Properties

### basePath?

> `optional` **basePath?**: `string`

Base path for the feature-flags endpoint. Defaults to "/feature-flags".

***

### skip?

> `optional` **skip?**: `boolean`

When true, the underlying evaluate query is not fired. Use this to avoid
fetching before the user is authenticated.
