# Terreno Cursor Plugin

Cursor plugin packaging agent skills for the Terreno monorepo.

## Skills

| Skill | Command | Purpose |
|---|---|---|
| **buildit** | `/buildit` | TDD implementation (specify → encode → fulfill) |
| **shipit** | `/shipit` | Full PR pipeline with CI and bot review handling |
| ai-prompt-governance | — | AI prompt constants and governance |
| autobot | — | Bot review automation (subset of shipit) |
| backend-test-env | — | Test env mutation for api/ai backends |
| check-watcher | — | Monitor GitHub Actions CI |
| commit | — | Commit with message |
| create-pr | — | Create draft PR |
| fix-conflicts | — | Merge conflict resolution |
| generate-sdk | — | Regenerate example-frontend SDK |
| improve-rulesync | — | Update skills/rules from session learnings |
| ip | `/ip` | Implementation plan from PRD |
| mongoose-schema-safety | — | Mongoose schema change checklist |
| respond-to-review | — | PR review comment handling |
| verify-ui-changes | — | UI change validation |

## Source of Truth

Skills live in `cursor-plugin/skills/`. Sync to `.rulesync/skills/` for rulesync propagation:

```bash
bun run skills:sync   # from repo root
bun run rules         # propagate to .cursor/, .agents/, etc.
```

## Installation

Install as a local Cursor plugin from this directory, or use the synced copies in `.agents/skills/` and `.cursor/skills/` after running `bun run rules`.
