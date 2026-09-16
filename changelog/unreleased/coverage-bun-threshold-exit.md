---
category: Fixed
---

`test:coverage` and new-file coverage no longer fail when Bun 1.4.2+ exits 1 for bunfig `coverageThreshold` after every test passed. Isolated LCOV merges still enforce the 95% / 90% gates.
