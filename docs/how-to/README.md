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
- [Create a Mongoose model](create-a-model.md) — Define models with proper conventions
- [Add GitHub OAuth authentication](add-github-oauth.md) — Enable GitHub login for your API
- [Configure Better Auth](configure-better-auth.md) — Set up Better Auth with social OAuth (Google, GitHub, Apple)
- [Add WebSocket integration](websocket-integration.md) — Set up real-time Socket.io connections
- [Expose Model Context Protocol tools](expose-mcp-tools.md) — Turn `modelRouter` models into MCP tools an LLM can call
- [Install agent skills](install-agent-skills.md) — Install Grow/Pick/Roast/Brew/Taste and domain skills with `npx skills`
- [Call external APIs](call-external-apis.md) — Authenticated HTTP client, retries, and error normalization for third-party integrations
- [Deploy to Google Cloud Platform](deploy-to-gcp.md) — Deploy demo and example apps to GCS with CDN
- [Migrate from @terreno/rtk to @terreno/syncdb](migrate-rtk-to-syncdb.md) — Move data sync to the local-first layer

## Coming Soon

- [Add feature flags](add-feature-flags.md) — Add feature flags and A/B testing to your app
- Add custom permissions
- Implement file uploads
- Configure email notifications
- Customize AI workflows
- Set up custom CI/CD pipelines
