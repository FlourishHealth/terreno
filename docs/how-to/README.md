# How-to Guides

Problem-oriented, practical steps. Use these when you know what you want to do.

## Deployment

- [Deployment baseline](../explanation/deployment-baseline.md) — seven requirements every host must satisfy
- [Build for web](build-for-web.md) — export static web bundle with correct API URL
- [Deploy to Google Cloud Platform](deploy-to-gcp.md) — index for GCP guides
- [Deploy backend to Cloud Run](deploy-backend-to-cloud-run.md) — container + Secret Manager + Cloud Run
- [Deploy web to GCS + CDN](deploy-web-to-gcs-cdn.md) — static hosting with SPA routing

## Contents

- [CircleCI](circleci.md) — Dual-run CI on CircleCI (package CI / policy / e2e; deploys later)
- [GitHub Actions CI](github-actions-ci.md) — Cut PR runtime: docs previews, compile-once e2e, pinned Bun
- [Add feature flags](add-feature-flags.md) — Add feature flags, A/B testing, and OpenFeature migration
- [Rate limiting](rate-limiting.md) — Opt-in HTTP limiter on `TerrenoApp` (memory or Redis)
- [Create a Mongoose model](create-a-model.md) — Define models with proper conventions
- [Seed a database](seed-a-database.md) — Idempotent sync, dry runs, and guarded reset-and-reseed
- [Add GitHub OAuth authentication](add-github-oauth.md) — Enable GitHub login for your API
- [Configure Better Auth](configure-better-auth.md) — Set up Better Auth with social OAuth (Google, GitHub, Apple)
- [Password reset and email verification](password-reset.md) — JWT routes, comms templates, Better Auth hooks
- [Add WebSocket integration](websocket-integration.md) — Set up real-time Socket.io connections
- [Expose Model Context Protocol tools](expose-mcp-tools.md) — Turn `modelRouter` models into MCP tools an LLM can call
- [Install agent skills](install-agent-skills.md) — `npx skills`, the Cursor plugin, the Codex plugin, or the Claude Code plugin
- [GitHub issue lifecycle](github-issue-lifecycle.md) — Create pick-ready issues, post a Pick plan, Pick ⇄ Roast
- [Call external APIs](call-external-apis.md) — Authenticated HTTP client, retries, and error normalization for third-party integrations
- [Upgrade banner](upgrade-banner.md) — Soft warning and hard-block app update UX
- [Migrate from @terreno/rtk to @terreno/syncdb](migrate-rtk-to-syncdb.md) — Move data sync to the local-first layer

## Admin

- [Add a model to the admin](admin-add-model.md) — `modelRouter({admin: ...})` setup
- [Import pre-built admins](admin-import-prebuilt.md) — Plugin `adminContribution()` wiring
- [Add a custom admin field widget](admin-custom-widget.md) — Custom field widgets
- [Customize the admin home](admin-custom-home.md) — Home slots and built-in widgets

## Coming Soon

- Add custom permissions
- Implement file uploads
- Configure email notifications
- Customize AI workflows
