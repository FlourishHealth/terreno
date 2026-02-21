# AI-Powered Workflows

Understanding Terreno's autonomous AI workflows for continuous improvement.

## Overview

Terreno uses GitHub Actions with AI agents to maintain code quality, documentation, and developer experience. These workflows run automatically and create pull requests when improvements are needed.

## Workflow Categories

### Documentation Workflows

#### Update Docs
**Trigger:** Push to master  
**Purpose:** Keeps documentation synchronized with code changes

Analyzes code diffs after each merge to identify:
- New or changed APIs, functions, classes
- Missing or outdated documentation
- Documentation gaps that need attention

**Output:** Draft pull requests with documentation updates following the Diátaxis framework (tutorials, how-to guides, reference, explanation).

**Philosophy:** Treats documentation gaps like failing tests — they must be fixed.

#### Update Rules
**Trigger:** Push to master  
**Purpose:** Keeps AI assistant rules synchronized with codebase changes

Maintains the single source of truth in `.rulesync/rules/` and ensures:
- `.cursorrules` (Cursor IDE)
- `.windsurfrules` (Windsurf IDE)
- `AGENTS.md` (Claude Code, Copilot)
- `.github/copilot-instructions.md` (GitHub Copilot)

**Workflow:**
1. Detects package changes, new APIs, or convention updates
2. Updates source files in `.rulesync/rules/`
3. Creates PR with instructions to run `bun run rules` to regenerate outputs
4. Ensures `rulesync-check` CI passes

**Key insight:** Rule files are code — they must be kept in sync with implementation.

### Code Quality Workflows

#### Daily JSDoc Improver
**Trigger:** Daily schedule + push to master  
**Purpose:** Systematically improves JSDoc documentation across the codebase

**Two modes:**
- **Targeted (on push):** Improves JSDoc for files changed in recent commits
- **Systematic (daily):** Three-phase approach covering entire codebase

**Output:** Draft PRs with improved JSDoc comments on exported functions, methods, and classes.

#### Daily Test Improver
**Trigger:** Daily schedule  
**Purpose:** Enhances test coverage and test quality

Analyzes test files and implementation to:
- Add missing test cases
- Improve test clarity and coverage
- Identify edge cases that need testing
- Ensure tests follow best practices

**Output:** Draft PRs with test improvements.

### Maintenance Workflows

#### Agentic Maintenance
**Trigger:** Daily at 00:37 UTC  
**Purpose:** Cleans up expired issues, discussions, and pull requests

Automatically closes expired entities based on the `expires` field in safe-outputs configuration. Schedule is determined by the shortest expiration time across all workflows.

**Prevents:** Stale issues and PRs from accumulating.

#### RulesSync Check
**Trigger:** Pull request  
**Purpose:** Validates that generated rule files are synchronized with sources

**Validation steps:**
1. Runs `bun run rules` to regenerate outputs
2. Checks for uncommitted changes
3. Fails if generated files don't match committed versions

**Prevents:** Merging PRs with out-of-sync rule files.

## CI/CD Workflows

### Package Testing

Each package has its own CI workflow that runs on pull requests and pushes:

| Workflow | Package | Tests |
|----------|---------|-------|
| `api-ci.yml` | @terreno/api | Unit tests, type checking, linting |
| `ui-ci.yml` | @terreno/ui | Component tests, type checking, linting |
| `rtk-ci.yml` | @terreno/rtk | Unit tests, type checking, linting |
| `mcp-server-ci.yml` | @terreno/mcp-server | Integration tests, type checking, linting |
| `example-backend-ci.yml` | example-backend | Integration tests, type checking |
| `example-frontend-ci.yml` | example-frontend | Build verification, type checking |
| `ui-demo-ci.yml` | demo | Build verification, type checking |

### Deployment Workflows

#### Demo Deploy
**Trigger:** Push to master  
**Purpose:** Deploys UI demo to Google Cloud Storage with Cloud CDN

**Architecture:** Static site hosting with custom domain, SSL, and CDN acceleration.

**Learn more:** [GCP Hosting Architecture](gcp-hosting-architecture.md), [Deploy to GCP](../how-to/deploy-to-gcp.md)

#### Frontend Example Deploy
**Trigger:** Push to master, pull request  
**Purpose:** Deploys example frontend with preview environments

**Features:**
- **Production:** Deploys to production GCS bucket on master
- **Preview:** Creates preview environments for pull requests
- **Cleanup:** Automatically removes preview environments when PRs close

#### MCP Server Deploy
**Trigger:** Push to master  
**Purpose:** Deploys Model Context Protocol server

Builds and deploys the MCP server for AI coding assistant integration.

#### Preview Cleanup
**Trigger:** Pull request close  
**Purpose:** Removes preview deployments when PRs are closed or merged

Ensures preview environments don't accumulate and waste resources.

### Security & Quality

#### CodeQL Analysis
**Trigger:** Push to master, pull request, schedule (weekly)  
**Purpose:** Security vulnerability scanning with GitHub CodeQL

**Languages analyzed:** JavaScript, TypeScript

**Output:** Security alerts in the Security tab when vulnerabilities are found.

#### Dependabot Auto-merge
**Trigger:** Dependabot pull request opened  
**Purpose:** Automatically merges dependency updates after CI passes

**Requirements for auto-merge:**
- All CI checks pass
- Dependabot PR (created by Dependabot)
- No conflicts
- 7-day cooldown for security (see Dependency Management)

**Learn more:** [Dependency Management](dependency-management.md)

### Publishing

#### Publish on Tag
**Trigger:** Tag push matching `v*.*.*`  
**Purpose:** Publishes packages to npm registry

**Workflow:**
1. Validates tag format and package versions match
2. Runs full test suite
3. Publishes to npm with appropriate tags (`latest` or `next`)
4. Creates GitHub release with changelog

**Packages published:**
- @terreno/api
- @terreno/ui
- @terreno/rtk
- @terreno/mcp-server

## Workflow Philosophy

### Single Source of Truth
- **Documentation:** Code is truth, docs must reflect it
- **Rules:** `.rulesync/rules/` is truth, generated files derive from it
- **Tests:** Implementation is truth, tests verify it

### Fail Fast
- All checks must pass before merge
- Generated files must be committed (no drift)
- Documentation gaps are treated like failing tests

### Autonomous Improvement
- Workflows create PRs, not commits
- PRs are drafts requiring human review
- Workflow agents make suggestions, humans make decisions

### Continuous Sync
- Documentation syncs on every master push
- Rules sync on every master push
- Dependencies update daily (Dependabot)
- Quality improvements run daily (JSDoc, tests)

## Working with AI Workflows

### When a Workflow Creates a PR

1. **Review the changes** — AI is helpful but not perfect
2. **Run suggested commands** — E.g., `bun run rules` for rule updates
3. **Test locally** — Ensure changes work as intended
4. **Approve or close** — Merge if valuable, close if not

### When a Workflow Fails

Check the workflow run logs in the Actions tab:
- **Documentation updates:** May need manual clarification
- **Rule updates:** May need manual fixes to `.rulesync/rules/`
- **JSDoc/test improvements:** May need guidance on conventions

### Customizing Workflows

Workflow definitions live in `.github/workflows/*.md` files. These are compiled into `.github/workflows/*.lock.yml` by the GitHub Agentic Workflows CLI.

**To customize:**
1. Edit the `.md` source file (e.g., `update-docs.md`)
2. Run `gh aw compile` (if using gh-aw CLI)
3. Commit both the `.md` and regenerated `.lock.yml`

**Note:** Never edit `.lock.yml` files directly — they are generated.

## Best Practices

### For Maintainers
- **Review workflow PRs regularly** — Don't let them accumulate
- **Provide feedback** — If a workflow generates bad suggestions, close with a comment explaining why
- **Tune prompts** — If a workflow consistently misses the mark, update the `.md` file

### For Contributors
- **Run CI before pushing** — `bun run lint && bun run test`
- **Update rules if needed** — `bun run rules` after changing `.rulesync/rules/`
- **Check workflow status** — Ensure your PR doesn't break workflows

### For Users
- **Check Actions tab** — See what's running and what's pending
- **Review draft PRs** — Workflow-generated PRs may contain useful improvements
- **Report issues** — If a workflow behaves unexpectedly, open an issue

## Troubleshooting

### Workflow doesn't run when expected
- Check `.github/workflows/*.yml` trigger configuration
- Verify branch name matches (usually `master`)
- Check workflow permissions and safe-outputs limits

### RulesSync check fails on PR
- Run `bun run rules` locally
- Commit any generated file changes
- Ensure `.rulesync/rules/` files have valid YAML frontmatter

### Dependabot PR doesn't auto-merge
- Verify all CI checks pass (green checkmarks)
- Check 7-day cooldown hasn't been violated
- Ensure no merge conflicts exist

### AI workflow creates poor quality PR
- Review the workflow definition in `.github/workflows/*.md`
- Consider customizing the prompt or instructions
- Close the PR with feedback for future improvements

## Related Documentation

- [Dependency Management](dependency-management.md) — Dependabot configuration and auto-merge
- [Deploy to GCP](../how-to/deploy-to-gcp.md) — Manual deployment guide
- [GCP Hosting Architecture](gcp-hosting-architecture.md) — Static site hosting design
- [Environment Variables](../reference/environment-variables.md) — Configuration reference
