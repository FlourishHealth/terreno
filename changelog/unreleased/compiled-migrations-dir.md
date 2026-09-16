---
category: Fixed
---

Compiled example-backend images (`bun build --compile`) no longer point admin migrations at `$bunfs`. The Docker image copies `migrations/` to `/app/migrations` and sets `MIGRATIONS_DIR`. A missing directory returns 404 `Migration directory not found` instead of a generic 500.
