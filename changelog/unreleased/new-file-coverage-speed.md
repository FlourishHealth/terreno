---
category: Changed
---

`new-file-coverage` no longer reruns a package's full test suite when that package's CI already produced LCOV. The 90% new-file gate runs against the package report instead. Remaining reruns use colocated tests, compile `@terreno/*` dist deps only when imported, and coverage-script unit tests run in a separate `coverage-scripts` job.
