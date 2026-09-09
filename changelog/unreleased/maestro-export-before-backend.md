---
category: Fixed
---

The `maestro-e2e` CI job now exports the example-frontend web bundle before starting the
example backend. That executor shares its memory with the mongo service container, and
bundling alongside a running backend got the export OOM-killed (`SIGKILL`) even though the
same export succeeds in `e2e-prepare`.
