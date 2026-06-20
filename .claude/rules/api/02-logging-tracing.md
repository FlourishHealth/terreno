---
paths:
  - api/**/*.ts
  - example-backend/**/*.ts
  - '**/server.ts'
---
# Backend logging and tracing (@terreno/api)

## Goals

- One request or background job should be followable across many log lines in plain text **and** in Log Explorer (structured jsonPayload).
- Prefer stable `key=value` dimensions over unique prose sentences.

## What you get for free

- **HTTP requests**: `logRequests` logs method, URL, user, and body (password redacted). Slow-request logging is optional via `loggingOptions`.
- **Request context** (AsyncLocalStorage): `requestId`, `jobId`, `sessionId`, `userId`, `traceId`, `spanId` when headers or JWT supply them. See `requestContext.ts` and `getCurrentLogContext`.
- **Structured correlation**: While an ALS scope is active (HTTP middleware, `runWithRequestContext`, etc.), every log line includes **`terrenoRequestLog`**: `{ requestId, userId }` where `userId` is `null` when the request is not tied to an authenticated user. This duplicates top-level `requestId` / `userId` so Log Explorer and BigQuery can always filter on one nested object.
- **Console / file lines**: Winston `printf` appends a suffix built from that context (see `formatLogContextSuffix`), including `logPrefix=...` when using a scoped logger with a `prefix`.

Incoming headers that matter for correlation include `x-request-id`, `x-cloud-trace-context`, `traceparent`, `x-trace-id`, `x-job-id`, `x-session-id`, `x-user-id` (see `REQUEST_CONTEXT_ATTRIBUTE_NAMES`).

## Scoped workflow logging

Use **`createScopedLogger`** when a handler, job, or service runs multiple steps and you want a consistent prefix and/or extra dimensions:

```typescript
import {createScopedLogger} from "@terreno/api";

const log = createScopedLogger({
  prefix: "[InvoicePay]",
  labels: {invoiceId: invoice._id.toString(), attempt: String(attemptNumber)},
});

log.info("Starting capture");
log.warn("Stripe rate limited, backing off");
```

- **`prefix`**: prepended to the human-readable message (easy grep in terminals and Log Explorer text search), and also stored as Winston metadata **`terrenoLogPrefix`** so structured transports get it as its own jsonPayload field (not only embedded in `message`).
- **`labels`**: normalized to strings, stored as Winston metadata under **`terrenoLabels`**. They appear in the same `key=value` suffix as request fields and are emitted as separate fields for structured transports (for example `@google-cloud/logging-winston` in `example-backend` when deployed).

Do **not** use label keys that collide with framework metadata: `requestId`, `jobId`, `sessionId`, `userId`, `traceId`, `spanId`, `terrenoLogPrefix`, `terrenoRequestLog`, `terrenoLabels`. Prefer domain names: `invoiceId`, `syncBatchId`, `webhookDeliveryId`.

If both `prefix` and `labels` are empty, `createScopedLogger({})` returns the global **`logger`** (same object).

## Feature-flagged (toggle) logging

Use **`createFeatureFlaggedLogger`** to no-op verbose logs unless a predicate is true. Pass any `() => boolean` source (environment variable, cached flag map, async-loaded config wrapped in a closure, or a call into `@terreno/feature-flags` from your app — not imported here to avoid package cycles).

```typescript
import {createFeatureFlaggedLogger, createScopedLogger} from "@terreno/api";

const jobLog = createFeatureFlaggedLogger({
  isEnabled: () => process.env.JOB_TRACE_LOGS === "true",
  target: createScopedLogger({prefix: "[Job]", labels: {jobName: "nightly-sync"}}),
});

jobLog.info("step 1"); // silent unless flag is on
```

- **`gateCatch`**: defaults to `false` so `promise.catch(jobLog.catch)` still records errors when the flag is off. Set **`gateCatch: true`** to silence `catch` while disabled.

## Message style (plain text and Log Explorer)

- Start with what happened, then optional detail: `User export finished` not `finished`.
- Use **low-cardinality prefixes** in brackets: `[WebhookStripe]`, `[NightlyJob]`, not unique IDs in the prefix (IDs belong in **`labels`**).
- For lists of steps, use the **same** `createScopedLogger` instance for the whole operation so every line shares identifiers.
- Put highly variable data at the end of the message or in splat args; keep the first ~80 characters useful for grouping in UIs.

## Google Cloud Logging

- In production, wire **`LoggingWinston`** (or equivalent) via `setupLogging({ ..., transports: [new LoggingWinston(...)] })` so jsonPayload receives Winston metadata including `terrenoRequestLog`, `terrenoLogPrefix`, `terrenoLabels`, and top-level request context fields.
- To correlate with Cloud Trace, ensure clients or load balancers send **`x-cloud-trace-context`** or W3C **`traceparent`**; the framework maps them into `traceId` / `spanId` where applicable.

## Sentry

When `USE_SENTRY_LOGGING=true`, log lines are mirrored to Sentry with attributes from `getCurrentLogContext()` merged with scoped **`terrenoLabels`** and **`terrenoLogPrefix`**, and with **`terrenoRequestLog`** when an ALS request scope is active.

## API surface

- **`logger`**: global `debug` / `info` / `warn` / `error` / `catch`.
- **`createScopedLogger(options)`**: scoped instance with the same methods (prefix + labels metadata).
- **`createFeatureFlaggedLogger(options)`**: wraps a `ScopedLogger` with an `isEnabled()` gate.
- **`formatLogContextSuffix(fields)`**: builds the trailing ` key=value` string (for custom formatters or tests). Does not include `terrenoRequestLog` (that object is Winston/Sentry metadata only).
- **`TerrenoRequestLogEntry`**: type for `terrenoRequestLog` payloads.

## Do not

- Use `console.log` for permanent server logs; use `logger` or a scoped logger.
- Log secrets, full auth tokens, or raw passwords (request logging already redacts `password` on bodies).
