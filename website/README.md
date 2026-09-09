# @terreno/website

Docusaurus site for Terreno documentation. Private workspace package — not published to npm. Docs content lives in `../docs` (the monorepo `docs/` tree), not inside this package.

## Install

From the monorepo root:

```bash
bun bootstrap
```

## Quick start

From the repo root:

```bash
bun run --filter '@terreno/website' start
```

Or from this directory:

```bash
bun run start
```

The site runs on **port 3001**. Generated API and component pages are produced by `bun run generate` before start/build.

## What's included

- `docusaurus.config.ts` — site config; `docs.path` is `../docs`
- `sidebars.ts` — navigation
- `scripts/generate-component-docs.ts` / `generate-api-reference.ts` — generated reference
- `scripts/docs-audit.ts` — drift checks for READMEs, reference pages, and leakage
- `versioned_docs/` — frozen docs for published versions

`docs/implementationPlans/` and `docs/tasks/` are excluded from the site (`exclude` in `docusaurus.config.ts`).

## Versioning and deploys

- Snapshot a version: `bun run docs:version` (from this directory)
- Production build: `bun run build` or root `bun run website:build`
- Hosting is Netlify (see the site's Netlify config in the repo). Set `DOCS_PREVIEW=true` for PR preview builds that skip historical versions.

## Documentation

Docs index: [docs/README.md](https://github.com/flourishhealth/terreno/blob/master/docs/README.md)

## License and Contributing

Licensed under the [MIT License](https://github.com/flourishhealth/terreno/blob/master/LICENSE). See [CONTRIBUTING.md](https://github.com/flourishhealth/terreno/blob/master/CONTRIBUTING.md) for contribution guidelines.
