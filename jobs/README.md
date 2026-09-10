# @terreno/jobs

Durable background jobs for Terreno apps — Mongo-backed queues with pluggable runners,
retries, schedules, and admin operations.

## Documentation

- [How-to: Durable background jobs](../docs/how-to/background-jobs.md) — install, workers, runners, admin
- [Reference: @terreno/jobs](../docs/reference/jobs.md) — API, models, routes, RBAC, env

## Quick start

```typescript
import {JobsApp, MongoJobRunner, getJobsService} from "@terreno/jobs";
import {TerrenoApp} from "@terreno/api";

const jobsApp = new JobsApp({runner: new MongoJobRunner()});

jobsApp.define("my/task", {
  handler: async (_payload, ctx) => {
    ctx.log.info("running");
  },
});

new TerrenoApp({userModel: User}).register(jobsApp).start();

await jobsApp.startWorker(); // explicit — register does not start a worker
await getJobsService().enqueue({name: "my/task", payload: {}});
```
