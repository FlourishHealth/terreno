# Explanation

Understanding-oriented documentation: concepts, architecture, and context.

## Deployment

- [Deployment baseline](deployment-baseline.md) — seven requirements for production Terreno apps
- [GCP deployment architecture](deployment-architecture-gcp.md) — Cloud Run + GCS/CDN topology and tradeoffs
- [GCP hosting architecture](gcp-hosting-architecture.md) — static site hosting with GCS and Cloud CDN (legacy detail)

## Contents

- [Local-first data](local-first-data.md) — Why the local store is the UI source of truth
- [Loop engineering](loop-engineering.md) — Fresh-invocation lifecycle, state, evidence, and orchestration boundaries
- [GitHub issue lifecycle](../how-to/github-issue-lifecycle.md) — Pick-ready issues and plan comments for Pick/Roast
- [Install agent skills](../how-to/install-agent-skills.md) — `npx skills add FlourishHealth/terreno`
- [AI-powered workflows](ai-workflows.md) — Autonomous documentation, testing, and maintenance workflows
- [Authentication architecture](authentication.md) — Better Auth, JWT, and optional MCP service tokens
- [Configuration system](configuration-system.md) — Runtime configuration with database persistence
- [Dependency management](dependency-management.md) — Dependabot, auto-merge, and security practices
- [Modular API design](modular-api-design.md) — 🚧 Why TerrenoApp replaces setupServer
- [modelRouter actions](model-router-actions.md) — Named collection and instance operations on modelRouter
- [Explicit `any` policy](explicit-any-policy.md) — Require rationale markers and ratchet usage per file
- [No barrel imports](no-barrel-imports.md) — Import concrete modules, not `index` re-export barrels
- [Production source rules](source-rules.md) — Arrow functions, Luxon, APIError, logging, findOne, `as any`
- [Positioning](positioning.md) — Canonical copy blocks and the honest Django/Rails comparison
- [Versioning policy](versioning-policy.md) — Lockstep `@terreno/*` versions, pre-1.0 breaks, deprecation window
- [How admin interfaces are shaped](admin-interface.md) — Screens, sidebar, `apiBase` vs `routeBase`
- [Admin plugin frontend widgets](admin-plugin-frontend.md) — Widget IDs from backend plugins
- [Consent admin migration](admin-consent-migration.md) — Which consent screens stay hand-written
- [Public roadmap process](roadmap-process.md) — GitHub roadmap vs Linear execution
- [Repository settings](repository-settings.md) — Maintainer GitHub settings that cannot be committed
- [Roadmap seed issues](roadmap-seed-issues.md) — Ready-to-paste GitHub issue bodies for IPs
