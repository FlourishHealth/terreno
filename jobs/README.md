# @terreno/jobs

Durable background jobs for Terreno apps — Mongo-backed queues with pluggable runners,
retries, schedules, and admin operations.

## Usage

```typescript
import {JobsApp} from "@terreno/jobs";
import {TerrenoApp} from "@terreno/api";

const jobs = new JobsApp();

new TerrenoApp({userModel: User}).register(jobs);

// Explicit opt-in — registration does not start a worker.
await jobs.startWorker();
```
