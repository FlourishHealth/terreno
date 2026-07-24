> **withApiErrorHandling**\<`T`\>(`fn`, `options`): `Promise`\<`T`\>

Wraps an external API call with standardized error handling: failures are normalized
via normalizeApiError, passed through the optional redactError hook, logged exactly
once, and rethrown.

In "raw" mode (default) the wrapper logs the normalized shape via the injected logger
and rethrows the original error. In "apiError" mode the wrapper throws a terreno
APIError — whose constructor already logs — so the wrapper itself stays silent to
preserve the log-once contract. The APIError title is stable per JSONAPI convention;
per-occurrence text goes in `detail`, built from the (redacted) normalized messages.

## Type Parameters

### T

`T`

## Parameters

### fn

() => `Promise`\<`T`\>

### options

[`WithApiErrorHandlingOptions`](../interfaces/WithApiErrorHandlingOptions.md)

## Returns

`Promise`\<`T`\>
