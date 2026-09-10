# Durable background jobs

Use `@terreno/jobs` when work must survive process restarts, retry with backoff, run on a
schedule, or dispatch through Cloud Tasks / Vercel Queues. Register `JobsApp`, define
handlers, enqueue rows in MongoDB, then start a worker explicitly.

For one-off scripts or in-process timers, keep `@terreno/api` [`wrapScript` / `cronjob`](../reference/api.md#wrapscript) — they are process-local and not durable. See [Jobs reference](../reference/jobs.md) for exports, routes, and defaults.

## Install and register

```bash
bun add @terreno/jobs
```

Peer dependency: `mongoose ^8.0.0 || ^9.0.0`.

```typescript
import {TerrenoApp} from "@terreno/api";
import {JobsApp, MongoJobRunner} from "@terreno/jobs";

const jobsApp = new JobsApp({
  accessControl, // optional — requires admin:access AND admin:jobs when set
  runner: new MongoJobRunner(),
  timezone: "UTC",
});

jobsApp.define("billing/capture", {
  handler: async (payload, ctx) => {
    ctx.log.info("capturing", {invoiceId: (payload as {invoiceId?: string}).invoiceId});
    // business logic
  },
  retry: {maxAttempts: 5, backoffMs: 1_000, maxBackoffMs: 900_000},
});

new TerrenoApp({userModel: User})
  .register(jobsApp)
  .start();
```

`JobsApp.register()` wires admin routes and optional `POST /jobs/execute`. It does **not**
start a worker. Call `jobsApp.startWorker()` from the API process or a dedicated worker
entrypoint.

## Enqueue

```typescript
import {getJobsService} from "@terreno/jobs";
import {DateTime} from "luxon";

await getJobsService().enqueue({
  name: "billing/capture",
  payload: {invoiceId: "inv_123"},
});

await getJobsService().enqueue({
  name: "billing/capture",
  payload: {invoiceId: "inv_123"},
  idempotencyKey: "capture:inv_123",
});

await getJobsService().enqueue({
  name: "billing/capture",
  payload: {invoiceId: "inv_123"},
  runAt: DateTime.utc().plus({hours: 1}).toJSDate(),
});
```

- Unknown `name` → `APIError` 400.
- Duplicate `(name, idempotencyKey)` returns the existing row and does **not** redispatch.
- `enqueue` persists first; the injected `JobRunner.enqueue` runs only for **new** rows.

## In-process worker vs standalone worker

| Mode | When | Steps |
| --- | --- | --- |
| In-process | Local dev, single replica | After `TerrenoApp.start()`, call `jobsApp.startWorker()`. |
| Standalone | Production API + worker split | API: `JOBS_START_WORKER=false`. Run `bun run jobs:worker` (example-backend) in a second process with the same job definitions and Mongo URI. |

Example-backend gates the API-process worker with `JOBS_START_WORKER` (unset → `true`):

```bash
# API only — no poll loop in the web process
JOBS_START_WORKER=false bun run backend:dev

# Dedicated worker (same env + Mongo as API)
bun run jobs:worker
```

On shutdown, call `jobsApp.stopWorker()` so in-flight handlers receive `ctx.signal` abort.

## Mongo runner: restart, retry, idempotency, schedules

**Restart:** Jobs are Mongo documents. A crashed worker leaves `running` rows; after
`lockTtlMs` (default 15 minutes) another worker reclaims them via `lockedAt` expiry.

**Retry:** Handler throws → `attemptCount++`, `attempts[]` entry, exponential backoff with
equal jitter, `status: "pending"` and future `runAt`. At `maxAttempts` (default 5) →
`status: "dead"`. Missing handler → `status: "failed"` (no automatic retry).

**Idempotency:** Optional `idempotencyKey` per `name` with a partial unique index. Use for
“enqueue once” semantics, not handler-side dedupe.

**Schedules:** Pass `schedule: {cron, timezone?}` on `define`. Worker `startWorker()` calls
`reconcileSchedules()`; the poll loop ticks due schedules, enqueues a child job, and skips a
tick when a child for that schedule is still `pending` / `running` / `scheduled`.

## At-least-once handlers

Delivery is **at-least-once**: lock expiry, Cloud Task retries, or Vercel queue redelivery
can run a handler more than once.

- Make handlers idempotent (stable keys, upserts, “already processed” checks).
- Use `idempotencyKey` on enqueue to prevent duplicate **rows**, not duplicate execution after admin retry/requeue.
- Respect `ctx.signal` for cooperative cancellation.
- Use `ctx.log` (scoped logger) — `jobId` is in request context for log correlation.

## Admin

`JobsApp.adminContribution()` registers:

- Custom screen `jobs` (dashboard)
- Home widget `jobs` (dead / running counts)

When `accessControl` is configured, callers need **both** `admin:access` and `admin:jobs`
(default `terrenoStatements.admin` includes both). When `accessControl` is omitted, routes
use legacy `user.admin === true`.

Frontend routes (example): `/admin/jobs`, `/admin/jobs/[id]`. Widgets ship in
`@terreno/admin-frontend` (`JOBS_ADMIN_WIDGETS`, `JOBS_HOME_WIDGETS`) — no host remap.
See [Import pre-built admins](admin-import-prebuilt.md).

Admin payloads are **hidden by default** (omit `redactPayload`). Opt in with a projection —
do not pass through the raw payload unless every field is safe for operators:

```typescript
// Default — no hook; payload omitted from admin API responses
new JobsApp({accessControl});

// Opt-in — expose only non-sensitive fields
new JobsApp({
  accessControl,
  redactPayload: ({name, payload}) => {
    if (name === "billing/capture") {
      return {invoiceId: (payload as {invoiceId?: string}).invoiceId};
    }
    return undefined;
  },
});
```

## GCP Cloud Tasks runner

Optional peer: `@google-cloud/tasks`.

```typescript
import {GcpCloudTasksRunner} from "@terreno/jobs/runners/gcpCloudTasks";

const jobsApp = new JobsApp({
  executeAuth: async (req) => {
    // Verify OIDC token on POST /jobs/execute — your responsibility
    return verifyGcpOidc(req);
  },
  runner: new GcpCloudTasksRunner({
    project: "my-project",
    location: "us-central1",
    queue: "background-jobs",
    publicUrl: "https://api.example.com",
    serviceAccountEmail: "tasks-invoker@my-project.iam.gserviceaccount.com",
    oidcAudience: "https://api.example.com/jobs/execute", // optional; defaults to execute URL
  }),
});
```

`GcpCloudTasksRunner` sets `requiresExecuteRoute: true`. Each enqueue creates an HTTP POST
to `{publicUrl}/jobs/execute` with body `{jobId}` (base64) and an OIDC token. Delayed jobs
use Cloud Tasks `scheduleTime`. `@terreno/jobs` does **not** read `GCP_TASK_*` env vars —
pass explicit constructor config.

## Vercel Queues runner

Optional peer: `@vercel/queue`.

```typescript
import {
  createVercelQueuesConsumer,
  VercelQueuesRunner,
} from "@terreno/jobs/runners/vercelQueues";

const jobsApp = new JobsApp({
  runner: new VercelQueuesRunner({topic: "terreno-jobs"}),
});

// Private consumer route (platform auth via handleCallback — not Express execute route)
export const POST = createVercelQueuesConsumer({host: jobsApp});
```

`vercel.json` must declare the queue trigger (private route):

```json
{
  "experimentalTriggers": [
    {"type": "queue/v2beta", "topic": "terreno-jobs"}
  ]
}
```

**7-day limit:** `delaySeconds` and retention are capped at 604_800 seconds (7 days). `runAt`
beyond that window throws `VercelQueueRunAtBeyondLimitError` at enqueue — use a shorter delay
or a different runner for longer deferrals. Retention is bumped to cover `delaySeconds` when
needed.

`VercelQueuesRunner` does **not** mount `POST /jobs/execute`; the consumer calls
`executeJobById` through `createVercelQueuesConsumer`.

## Custom runner

Implement `JobRunner`:

```typescript
import type {JobRunner} from "@terreno/jobs";

const runner: JobRunner = {
  id: "my-bus",
  requiresExecuteRoute: false, // set true if you use POST /jobs/execute
  async enqueue(job) {
    await myBus.publish({jobId: job._id.toString()});
  },
  async start({jobs, signal, pollIntervalMs}) {
    // optional — MongoJobRunner implements start; dispatch-only runners omit it
  },
};
```

Inject with `new JobsApp({runner})`. Dispatch failures on untouched `pending` rows roll back
the insert when possible (`JobDispatchError`).

## Related

- [Jobs reference](../reference/jobs.md)
- [Environment variables — jobs](../reference/environment-variables.md#background-jobs)
- [Import pre-built admins](admin-import-prebuilt.md)
- Implementation plan: [job-queues.md](../implementationPlans/job-queues.md)
