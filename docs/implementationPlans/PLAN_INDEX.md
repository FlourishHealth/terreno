# Implementation plan index

Tracks active and completed implementation plans (IP) for Terreno. File paths are relative to `docs/implementationPlans/`.

## Programs

Umbrella plans that coordinate several IPs.

| Program | Status | Created | IPs |
|---------|--------|---------|-----|
| [Open source launch](oss-launch-program.md) | Draft — decisions recorded; Vercel spike open | 2026-07-27 | 15 |

## Active

| Plan | Status | Created | Tasks |
|------|--------|---------|-------|
| [Admin improvements (post–v2 architecture)](admin-improvements.md) | Approved — decisions 2026-08-20 | 2026-06-01 | [tasks](../tasks/admin-improvements.md) |
| [Migrate CI/CD to CircleCI](migrate-cicd-to-circleci.md) | Draft — decisions recorded | 2026-08-17 | [tasks](../tasks/migrate-cicd-to-circleci.md) |
| [@terreno/syncdb-codegen](syncdb-codegen.md) | Draft | 2026-07-08 | [tasks](../tasks/syncdb-codegen.md) |
| [SyncDB local-first data layer (v2)](syncdb-local-first.md) | In progress — Phases 1–8 landed, Phase 9 follow-ups open | 2026-06-23 | [tasks](../tasks/syncdb-local-first.md) |
| [SyncDB hardening (syncdb-2)](terreno-syncdb-2.md) | Implemented — Phases A–F landed; deviations carried into Phase 9 | 2026-07-11 | [tasks](../tasks/syncdb-local-first.md) (Phase 8/9) |
| [SyncDB Phase C design](syncdb-phase-c-design.md) | Implemented — design authority for C1–C8 | 2026-07-11 | [tasks](../tasks/syncdb-local-first.md) (Phase 8) |

## Completed

| Plan | Status | Created | Tasks |
|------|--------|---------|-------|
| [Admin UI v2 — Django-parity admin](admin-ui-v2-django-parity.md) | Complete — phased tasks verified in-repo | 2026-06-15 | [tasks](../tasks/admin-ui-v2-django-parity.md) |
| [APIError redesign — standards-first extension of Error](apierror-standard-error-redesign.md) | Complete | 2026-07-28 | n/a |

## Deferred / Closed

*(Plans parked or superseded.)*

## Backlog

*(Links to ideas not yet promoted to a full IP.)*

| Idea | Notes |
|------|-------|
| [Langfuse integration](terreno-langfuse-integration.md) | AI observability plugin |
| [modelRouter MCP tools](model-router-mcp.md) | MCP surface for consumer app APIs |
| [Offline mode](offline-mode.md) | Superseded in large part by [syncdb](syncdb-local-first.md) — confirm and close |
| [modelRouter actions](model-router-actions.md) | — |
| [B2B platform](b2b-platform-program.md) | Draft — decisions D1–D7 resolved | 2026-08-09 | 10 written (+ [rbac-permissions](rbac-permissions.md)); 30 roadmap items seeded |
| [RBAC Permissions](rbac-permissions.md) | Draft (API design) | 2026-07-08 | TBD |
| [SyncDB Local-First Data Layer](syncdb-local-first.md) | In progress ([PR #869](https://github.com/flourishhealth/terreno/pull/869)) | 2026-07-13 | [tasks](../tasks/syncdb-local-first.md) |
| [MCP Boost parity](mcp-boost-parity.md) | In progress ([PR #802](https://github.com/flourishhealth/terreno/pull/802)) | 2026-06-21 | TBD |
| [Infrastructure MCP server](infra-mcp.md) | Draft — blocked on [RBAC](rbac-permissions.md) | 2026-08-09 | [tasks](../tasks/infra-mcp.md) |
| [OSS governance baseline](oss-governance-baseline.md) | Draft | None | [tasks](../tasks/oss-governance-baseline.md) |
| [Public roadmap on GitHub](public-roadmap-github.md) | Draft | None | [tasks](../tasks/public-roadmap-github.md) |
| [Deploy to GCP (generalized)](deploy-to-gcp.md) | Draft | None | [tasks](../tasks/deploy-to-gcp.md) |
| [Agentic SDLC plugin (`/terreno-*`)](agentic-sdlc-plugin.md) | Draft | Partial | [tasks](../tasks/agentic-sdlc-plugin.md) |
| [RTK deprecation and syncdb migration docs](rtk-to-syncdb-migration-docs.md) | Draft | **Blocked** (gating IP) | [tasks](../tasks/rtk-to-syncdb-migration-docs.md) |
| [Positioning — Django/Rails for TypeScript](positioning-django-rails-universal.md) | Draft | Partial | [tasks](../tasks/positioning-django-rails-universal.md) |
| [Reference documentation coverage](docs-reference-coverage.md) | Draft | Blocked | [tasks](../tasks/docs-reference-coverage.md) |
| [AI-first tutorials](docs-tutorials-ai-first.md) | Draft | Blocked | [tasks](../tasks/docs-tutorials-ai-first.md) |
| [Deployment foundation](deployment-foundation.md) | Draft | Partial | [tasks](../tasks/deployment-foundation.md) |
| [Deploy to Vercel](deploy-to-vercel.md) | Draft | Partial | [tasks](../tasks/deploy-to-vercel.md) |
| [Upgrade guides and skill](upgrade-guides-and-skill.md) | Draft | Blocked | [tasks](../tasks/upgrade-guides-and-skill.md) |
| [The AI development loop (Boost)](ai-dev-loop-boost.md) | Draft | Partial | [tasks](../tasks/ai-dev-loop-boost.md) |
| [Dogfooding run and launch blog post](build-terreno-app-validation.md) | Draft | Blocked | [tasks](../tasks/build-terreno-app-validation.md) |
| [Examples, demo, and test coverage](examples-demo-coverage.md) | Draft | Partial | [tasks](../tasks/examples-demo-coverage.md) |
| [Web SSR and admin SPA](web-ssr-and-admin-spa.md) | Draft | Partial | [tasks](../tasks/web-ssr-and-admin-spa.md) |
| [Pluggable communications layer (@terreno/comms)](comms-abstraction.md) | Draft | None | [tasks](../tasks/comms-abstraction.md) |
| [Comms adapter — Expo push](comms-adapter-expo-push.md) | Draft | None | [tasks](../tasks/comms-adapter-expo-push.md) |
| [Comms adapter — Twilio SMS](comms-adapter-twilio-sms.md) | Draft | None | [tasks](../tasks/comms-adapter-twilio-sms.md) |
| [Comms adapter — Twilio Verify (OTP)](comms-adapter-twilio-verify.md) | Draft | None | [tasks](../tasks/comms-adapter-twilio-verify.md) |
| [Comms adapter — SendGrid email](comms-adapter-sendgrid.md) | Draft | None | [tasks](../tasks/comms-adapter-sendgrid.md) |
| [Comms admin dashboard (errors, retries, log digging)](comms-admin-dashboard.md) | Draft | Partial | [tasks](../tasks/comms-admin-dashboard.md) |
| [Password reset and email verification](password-reset-and-email-verification.md) | Draft | None | [tasks](../tasks/password-reset-and-email-verification.md) |
| [Organizations, teams, and multi-tenant scoping](orgs-and-teams.md) | Draft | None | [tasks](../tasks/orgs-and-teams.md) |
| [Stripe billing and subscriptions](billing-stripe.md) | Draft | None | [tasks](../tasks/billing-stripe.md) |
| [Native module baseline (next major)](native-module-baseline.md) | Draft | None | [tasks](../tasks/native-module-baseline.md) |
