---
category: Added
---

Pull requests now fail when a newly added workspace `.ts` or `.tsx` implementation
file is below 90% function coverage or 90% line coverage. Run
`bun run check:new-file-coverage --base=origin/master --threshold=90` locally.
The gate reuses each package's `bun test` file arguments so Playwright `*.spec.ts`
files are not collected. Glob arguments are expanded before spawn so packages such
as `example-frontend` still collect `*.test.ts` files. Globs that match no files
are omitted.
