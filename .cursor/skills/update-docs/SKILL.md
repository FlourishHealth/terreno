---
name: update-docs
description: Keep Terreno docs in sync when public APIs change — regenerate component pages, update reference/how-to docs, and run rulesync before opening a PR.
---
# Update Docs

Use when a change touches user-facing APIs, components, routes, configuration, or environment variables.

## When to run

Run before opening a PR when the diff includes any of:

- New or changed exports in `api/`, `ui/`, `rtk/`, `ai/`, `feature-flags/`, or `admin-*`
- New UI components or changed prop types in `@terreno/ui`
- New `modelRouter` / `TerrenoApp` options, permissions, or custom routes
- New environment variables or setup steps

Skip for internal refactors, test-only changes, and dependency bumps with no usage change.

## Workflow

1. **Map changes to docs**
   - UI component → generated page under `docs/reference/components/` (via `website` generate script) + demo story in `demo/stories/`
   - Package export → `docs/reference/<package>.md` and relevant how-to guides
   - Auth / deployment → `docs/how-to/` or `docs/reference/environment-variables.md`

2. **Regenerate generated docs**

   ```bash
   cd ui && bun run compile && bun run types
   bun run website:generate
   ```

   Generated output is build-time only (gitignored) except versioned snapshots created at release.

3. **Update hand-written docs**
   - Keep edits minimal — update the existing section in place
   - Prefer code examples over prose
   - Follow Diátaxis layout: `docs/tutorials/`, `docs/how-to/`, `docs/reference/`, `docs/explanation/`

4. **Verify site build**

   ```bash
   bun run website:build
   ```

5. **Sync AI rules when docs change agent-facing guidance**

   ```bash
   bun run rules
   ```

6. **Commit** docs changes, regenerated rules if any, and note in the PR that the docs deploy preview should be checked.

## Integration

- `implement` and `create-pr` skills: if public APIs changed, run this skill before submit.
- `verify-ui-changes`: new components need a story **and** a generated component doc page that renders in the docs deploy preview.
