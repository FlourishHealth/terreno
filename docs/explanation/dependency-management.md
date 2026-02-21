# Dependency Management

Understanding how Terreno manages dependencies, updates, and security.

## Overview

Terreno uses a multi-layered approach to dependency management:
- **Bun catalogs** for version consistency across the monorepo
- **Dependabot** for automated dependency updates
- **Auto-merge workflow** for hands-off maintenance
- **7-day cooldown** for security and stability

## Bun Catalogs

Shared dependency versions are defined in the root `package.json` under the `catalog` field. Workspace packages reference catalog versions with `catalog:` prefix.

**Benefits:**
- Single source of truth for shared dependency versions
- Consistent versions across all packages
- Easier updates — change once, apply everywhere

**Example:**

``````json
// root package.json
{
  "catalog": {
    "react": "18.2.0",
    "react-native": "0.73.2"
  }
}
``````

``````json
// ui/package.json
{
  "dependencies": {
    "react": "catalog:",
    "react-native": "catalog:"
  }
}
``````

## Dependabot Configuration

Dependabot monitors dependencies across the monorepo with different update schedules and grouping strategies.

### Update Groups

| Group | Packages | Schedule | Strategy |
|-------|----------|----------|----------|
| **GitHub Actions** | Workflow dependencies | Weekly | Individual PRs |
| **Root** | Catalog & dev tools | Monthly | Grouped PR |
| **Backend** | `api`, `example-backend`, `mcp-server` | Monthly | Grouped PR |
| **Frontend** | `ui`, `rtk`, `demo`, `example-frontend` | Monthly | Grouped PR |

### 7-Day Cooldown

**Why:** Malicious actors occasionally compromise NPM packages. Most compromises are detected and removed within 24 hours.

**How it works:**
- Dependabot waits 7 days after a package version is published before creating a PR
- Security updates **bypass** the cooldown (immediate PRs for CVEs)
- Reduces risk of incorporating compromised dependencies

**Configuration:**

``````yaml
cooldown:
  default-days: 7
``````

### Ignored Dependencies

Frontend packages ignore catalog-managed dependencies to prevent duplicate PRs. Updates to these dependencies must be done via the root `package.json` catalog.

**Examples:**
- `react`, `react-native`, `expo`, `typescript`
- `@reduxjs/toolkit`, `luxon`, `lodash`
- All other dependencies listed in the root catalog

## Auto-Merge Workflow

The `dependabot-auto-merge.yml` workflow automatically approves and merges Dependabot PRs once all CI checks pass.

### How It Works

1. **Trigger:** Runs on every pull request
2. **Condition:** Only executes if author is `dependabot[bot]`
3. **Approval:** Automatically approves the PR using `GITHUB_TOKEN`
4. **Auto-merge:** Enables squash-merge with `--auto` flag
5. **Merge:** PR merges automatically once all required status checks pass

### Prerequisites

For auto-merge to function:
1. ✅ Enable "Allow auto-merge" in **Settings → General → Pull Requests**
2. ✅ Configure branch protection on `master` with required status checks
3. ✅ All configured CI workflows (api-ci, ui-ci, etc.) must pass

### Security Considerations

**Why this is safe:**
- PRs only merge after **all CI checks pass** (tests, linting, builds)
- Security updates bypass cooldown but still require passing tests
- Grouped PRs reduce noise while maintaining test coverage
- Failed CI checks prevent merge — human review required

**When human review is needed:**
- CI failures on Dependabot PRs
- Major version updates (may include breaking changes)
- Updates that touch critical dependencies (e.g., Express, React Native core)

## Workflow Diagram

``````mermaid
flowchart TD
    A[Package Version Published] -->|Wait 7 days| B{Security Update?}
    B -->|Yes| C[Immediate PR Creation]
    B -->|No| D[Create PR after cooldown]
    C --> E[Auto-merge Workflow Triggered]
    D --> E
    E --> F{All CI Checks Pass?}
    F -->|Yes| G[Auto-approve PR]
    F -->|No| H[Require Human Review]
    G --> I[Enable Auto-merge]
    I --> J[Squash & Merge]
    H --> K[Fix Issues & Re-run CI]
    K --> F
``````

## Best Practices

### When to Update the Catalog

Update root `package.json` catalog when:
- Multiple packages need the same dependency update
- Major version updates require coordinated changes
- New shared dependencies are introduced

### When to Update Individual Packages

Update individual package dependencies when:
- Package-specific dependencies (not in catalog)
- Testing new versions before promoting to catalog
- Overriding catalog versions for specific use cases (rare)

### Monitoring Dependabot

Check Dependabot activity:
1. Navigate to **Security → Dependabot** in GitHub repository
2. Review open PRs with `dependencies` label
3. Check for failed updates or security alerts
4. Monitor auto-merge success rate in Actions tab

## Troubleshooting

### Dependabot PR Not Auto-Merging

**Symptom:** PR approved but not merging

**Checks:**
1. Are all required status checks passing?
2. Is auto-merge enabled in repository settings?
3. Is branch protection configured on `master`?
4. Check Actions tab for workflow failures

### CI Failures on Dependency Updates

**Symptom:** Dependabot PR fails CI

**Actions:**
1. Review CI logs to identify breaking changes
2. Check dependency changelog for migration guides
3. Update code to accommodate breaking changes
4. Push fixes to the Dependabot branch or close PR

### Too Many Dependabot PRs

**Symptom:** Overwhelming number of update PRs

**Solutions:**
- Verify grouping is configured correctly in `.github/dependabot.yml`
- Adjust update schedules (weekly → monthly)
- Add dependencies to ignore list if catalog-managed
- Increase cooldown period if needed

## Related Documentation

- [CI/CD Workflows](../how-to/setup-cicd.md) *(coming soon)*
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
