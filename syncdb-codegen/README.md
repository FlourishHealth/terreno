# @terreno/syncdb-codegen

Prototype generator that emits typed [`@terreno/syncdb`](../syncdb) operation
descriptors from a backend OpenAPI spec — the syncdb counterpart to the RTK
Query SDK codegen.

It scans OpenAPI paths for REST resource collections (a `/{name}` list/create
path paired with a `/{name}/{id}` item path) and produces a descriptor per
collection plus a ready-to-write TypeScript module.

```typescript
import {generateSyncDbDescriptors} from "@terreno/syncdb-codegen";

const openapi = await fetch("http://localhost:4000/openapi.json").then((r) => r.json());
const {descriptors, source} = generateSyncDbDescriptors({openapi});
// write `source` to e.g. store/syncDbDescriptors.ts
```

Status: prototype (IP Phase 6.1). Emits descriptors for resource collections;
typed argument/response schema generation is future work.
