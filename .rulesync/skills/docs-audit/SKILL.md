---
name: docs-audit
description: >-
  Detect documentation drift — undocumented components, missing TypeDoc props,
  and stale generated pages. Runnable locally or via the weekly CI workflow.
---
# Docs Audit

Find gaps between code and documentation before they reach users.

## When to run

- On demand before a release
- After large UI or API refactors
- When the weekly `docs-audit` GitHub Action opens a drift issue

## Workflow

1. **Prepare TypeDoc input**

   ```bash
   cd ui && bun run compile && bun run types
   ```

2. **Run the audit script**

   ```bash
   bun run website/scripts/docs-audit.ts
   ```

3. **Review output**
   - Missing generated component pages → run `bun run website:generate`
   - Components without TypeDoc props → add JSDoc on props in `ui/src/Common.ts` (or the component's props interface)
   - Broken internal links → `bun run website:build` (Docusaurus fails on broken links)

4. **Optional deeper checks**
   - Diff `ui/src/index.tsx` exports against `docs/reference/ui.md`
   - Diff `api/src/index.ts` exports against `docs/reference/api.md`
   - Search docs for removed symbol names

5. **Fix and re-run** until the audit passes.

## CI

`.github/workflows/docs-audit.yml` runs weekly (Mondays 14:00 UTC) and opens a GitHub issue when drift is detected.

## Integration

- `release` skill: run docs audit before cutting a release if the changelog includes API surface changes.
- `update-docs` skill: use audit output as the fix list after regenerating docs.
