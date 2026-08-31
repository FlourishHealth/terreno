---
category: Fixed
---

`bun run check:new-file-coverage` now expands the glob arguments it reads from a package's
`test` script before spawning `bun`, so packages without a `src/` directory (such as
`example-frontend`) no longer fail with "filters did not match any test files". Expo Router
route-structural entry files under `app/` (`index`, `_layout`, `+not-found`, and dynamic
segments) are exempt from the gate; the router mounts them by file path and the screens they
render are covered in their owning package.
