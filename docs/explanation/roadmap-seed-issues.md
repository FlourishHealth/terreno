# Roadmap seed issues

Ready-to-paste GitHub issue bodies for IPs on the public roadmap — the
[OSS launch program](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/oss-launch-program.md) IPs plus other
roadmap-tracked work. Open one tracking issue per IP when the IP reaches **Approved**, then
add it to the **Terreno Roadmap** project with the field values below.

---

## oss-governance-baseline

**Title:** `[Roadmap] OSS governance baseline`

**Labels:** `area:dx`, `type:chore`  
**Project fields:** Area=`dx`, Target=`Next`, Impact=`Improvement`, IP=`oss-governance-baseline`, Status=`Shipped`

Establishes the legal and community foundation required before Terreno can launch as a public
open-source project. It adds a root MIT license, contribution and security policies, a
changelog, GitHub community health files, and CI checks so every published npm package ships
with correct licensing. Without this work, the repository cannot credibly invite outside
contributors or consumers.

- **Implementation plan:** [oss-governance-baseline.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/oss-governance-baseline.md)
- **Tasks:** [oss-governance-baseline.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/oss-governance-baseline.md)
- **RTK flag:** None
- **Depends on:** —

---

## public-roadmap-github

**Title:** `[Roadmap] Public roadmap on GitHub`

**Labels:** `area:dx`, `type:feature`  
**Project fields:** Area=`dx`, Target=`Next`, Impact=`Improvement`, IP=`public-roadmap-github`, Status=`In progress`

Runs Terreno's public roadmap on GitHub while keeping Linear as the internal execution
tracker. It sets up GitHub Discussions categories, a Terreno Roadmap project board, label
taxonomy, automated ROADMAP.md generation, and a one-way GitHub-to-Linear bridge for tracked
issues. Outside contributors can see priorities and propose work without maintainers
duplicating sprint planning.

- **Implementation plan:** [public-roadmap-github.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/public-roadmap-github.md)
- **Tasks:** [public-roadmap-github.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/public-roadmap-github.md)
- **RTK flag:** None
- **Depends on:** oss-governance-baseline

---

## deploy-to-gcp

**Title:** `[Roadmap] Deploy to GCP (generalized)`

**Labels:** `area:deploy`, `type:docs`  
**Project fields:** Area=`deploy`, Target=`Next`, Impact=`Improvement`, IP=`deploy-to-gcp`, Status=`Planned`

Turns Terreno's GCP deployment story from Flourish-specific infrastructure into a reusable
guide any Terreno app can follow. It documents Cloud Run backend hosting, GCS plus CDN for
static web export, a reusable Terraform module, parameterized scripts, and a deploy-gcp
agent skill with confirmation gates. The guide covers websocket, replica-set, and
session-affinity constraints that commonly break production Terreno deployments.

- **Implementation plan:** [deploy-to-gcp.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/deploy-to-gcp.md)
- **Tasks:** [deploy-to-gcp.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/deploy-to-gcp.md)
- **RTK flag:** None
- **Depends on:** deployment-foundation

---

## agentic-sdlc-plugin

**Title:** `[Roadmap] Agentic SDLC plugin (/terreno-*)`

**Labels:** `area:dx`, `type:feature`  
**Project fields:** Area=`dx`, Target=`Next`, Impact=`Feature`, IP=`agentic-sdlc-plugin`, Status=`Planned`

Packages and documents Terreno's five-stage `/terreno-*` agentic SDLC pipeline as a portable,
publicly installable Cursor plugin. The pipeline takes work from a raw request through
planning, test-driven implementation, independent verification, submission with evidence,
and a review loop until mergeable. Today the tooling exists inside the monorepo but is
invisible and breaks in consumer apps.

- **Implementation plan:** [agentic-sdlc-plugin.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/agentic-sdlc-plugin.md)
- **Tasks:** [agentic-sdlc-plugin.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/agentic-sdlc-plugin.md)
- **RTK flag:** Partial
- **Depends on:** positioning-django-rails-universal, oss-governance-baseline

---

## rtk-to-syncdb-migration-docs

**Title:** `[Roadmap] RTK deprecation and syncdb migration docs`

**Labels:** `area:syncdb`, `type:docs`, `deprecation`, `status:blocked`  
**Project fields:** Area=`syncdb`, Target=`Next`, Impact=`Improvement`, IP=`rtk-to-syncdb-migration-docs`, Status=`Planned`

> Blocked on PR #869. The Project **Status** field has no `Blocked` option, so gating is
> tracked with the `status:blocked` issue label instead.

Makes Better Auth plus `@terreno/syncdb` the documented, supported frontend platform and gives
RTK Query consumers a tested migration path. It covers deprecation policy, a step-by-step
migration guide, syncdb reference docs, auth repositioning, and updates to agent rules, MCP
bootstrap output, and upgrade notes. Gates most Wave 1 launch documentation.

- **Implementation plan:** [rtk-to-syncdb-migration-docs.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/rtk-to-syncdb-migration-docs.md)
- **Tasks:** [rtk-to-syncdb-migration-docs.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/rtk-to-syncdb-migration-docs.md)
- **RTK flag:** Blocked (PR #869)
- **Depends on:** PR #869

---

## positioning-django-rails-universal

**Title:** `[Roadmap] Positioning — Django/Rails for TypeScript`

**Labels:** `area:docs`, `type:docs`  
**Project fields:** Area=`docs`, Target=`Next`, Impact=`Improvement`, IP=`positioning-django-rails-universal`, Status=`Planned`

Aligns Terreno's messaging across README, docs site, agent context files, and npm package
metadata under one positioning statement: Django/Rails for TypeScript with universal app
support, organized around batteries included, universal by default, and AI-native pillars.

- **Implementation plan:** [positioning-django-rails-universal.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/positioning-django-rails-universal.md)
- **Tasks:** [positioning-django-rails-universal.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/positioning-django-rails-universal.md)
- **RTK flag:** Partial
- **Depends on:** rtk-to-syncdb-migration-docs

---

## docs-reference-coverage

**Title:** `[Roadmap] Reference documentation coverage`

**Labels:** `area:docs`, `type:docs`  
**Project fields:** Area=`docs`, Target=`Next`, Impact=`Improvement`, IP=`docs-reference-coverage`, Status=`Planned`

Gives every published Terreno package a real README and a public docs/reference page instead
of stubs. Adds missing reference pages, de-stubs package READMEs, sanitizes internal
leakage, and extends docs-audit CI to catch drift.

- **Implementation plan:** [docs-reference-coverage.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/docs-reference-coverage.md)
- **Tasks:** [docs-reference-coverage.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/docs-reference-coverage.md)
- **RTK flag:** Blocked
- **Depends on:** rtk-to-syncdb-migration-docs, positioning-django-rails-universal

---

## docs-tutorials-ai-first

**Title:** `[Roadmap] AI-first tutorials`

**Labels:** `area:docs`, `type:docs`  
**Project fields:** Area=`docs`, Target=`Next`, Impact=`Feature`, IP=`docs-tutorials-ai-first`, Status=`Planned`

Replaces Terreno's thin getting-started page with a full tutorial path where the
AI-assisted workflow is the default. Six tutorials cover examples, first app, MCP, AI
features, admin panel, and production deploy — all on syncdb + Better Auth.

- **Implementation plan:** [docs-tutorials-ai-first.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/docs-tutorials-ai-first.md)
- **Tasks:** [docs-tutorials-ai-first.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/docs-tutorials-ai-first.md)
- **RTK flag:** Blocked
- **Depends on:** docs-reference-coverage, ai-dev-loop-boost, deployment-foundation

---

## deployment-foundation

**Title:** `[Roadmap] Deployment foundation`

**Labels:** `area:deploy`, `type:docs`  
**Project fields:** Area=`deploy`, Target=`Next`, Impact=`Improvement`, IP=`deployment-foundation`, Status=`Planned`

Defines the provider-agnostic deployment baseline every Terreno production app needs: core
requirements, environment-variable reference, Expo web output modes, and a canonical
example-backend Dockerfile with CI validation.

- **Implementation plan:** [deployment-foundation.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/deployment-foundation.md)
- **Tasks:** [deployment-foundation.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/deployment-foundation.md)
- **RTK flag:** Partial
- **Depends on:** —

---

## deploy-to-vercel

**Title:** `[Roadmap] Deploy to Vercel`

**Labels:** `area:deploy`, `type:docs`  
**Project fields:** Area=`deploy`, Target=`Next`, Impact=`Improvement`, IP=`deploy-to-vercel`, Status=`Planned`

Documents Expo web export on Vercel, preview-deployment CORS and Better Auth origin handling,
and a deploy-vercel skill with websocket verification. Requires a spike on backend hosting
options.

- **Implementation plan:** [deploy-to-vercel.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/deploy-to-vercel.md)
- **Tasks:** [deploy-to-vercel.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/deploy-to-vercel.md)
- **RTK flag:** Partial
- **Depends on:** deployment-foundation

---

## upgrade-guides-and-skill

**Title:** `[Roadmap] Upgrade guides and upgrading-terreno skill`

**Labels:** `area:mcp`, `type:docs`  
**Project fields:** Area=`mcp`, Target=`Next`, Impact=`Improvement`, IP=`upgrade-guides-and-skill`, Status=`Planned`

Makes upgrading Terreno across lockstep-published packages a documented, repeatable process.
Backfills upgrade notes, adds versioning policy, ships an upgrading-terreno skill, and
enforces upgrade-note requirements in release CI.

- **Implementation plan:** [upgrade-guides-and-skill.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/upgrade-guides-and-skill.md)
- **Tasks:** [upgrade-guides-and-skill.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/upgrade-guides-and-skill.md)
- **RTK flag:** Blocked
- **Depends on:** rtk-to-syncdb-migration-docs, oss-governance-baseline

---

## ai-dev-loop-boost

**Title:** `[Roadmap] AI development loop (MCP Boost)`

**Labels:** `area:mcp`, `type:feature`  
**Project fields:** Area=`mcp`, Target=`Next`, Impact=`Feature`, IP=`ai-dev-loop-boost`, Status=`Planned`

Documents Terreno's AI-native development loop: search docs, generate code, run the app,
observe merged logs and client state, then fix and iterate. Builds on MCP Boost parity (PR
#802).

- **Implementation plan:** [ai-dev-loop-boost.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/ai-dev-loop-boost.md)
- **Tasks:** [ai-dev-loop-boost.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/ai-dev-loop-boost.md)
- **RTK flag:** Partial
- **Depends on:** PR #802

---

## build-terreno-app-validation

**Title:** `[Roadmap] Dogfooding run and launch blog post`

**Labels:** `area:docs`, `type:chore`  
**Project fields:** Area=`docs`, Target=`Next`, Impact=`Improvement`, IP=`build-terreno-app-validation`, Status=`Planned`

Executes the OSS launch acceptance test: an agent builds and deploys a real universal app
using only public docs and skills, then publishes a friction log and blog post.

- **Implementation plan:** [build-terreno-app-validation.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/build-terreno-app-validation.md)
- **Tasks:** [build-terreno-app-validation.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/build-terreno-app-validation.md)
- **RTK flag:** Blocked
- **Depends on:** docs-tutorials-ai-first, ai-dev-loop-boost, deploy-to-vercel, docs-reference-coverage

---

## examples-demo-coverage

**Title:** `[Roadmap] Examples, demo, and test coverage`

**Labels:** `area:examples`, `type:chore`  
**Project fields:** Area=`examples`, Target=`Future`, Impact=`Improvement`, IP=`examples-demo-coverage`, Status=`Planned`

Closes credibility gaps in examples, the UI demo app, and CI coverage gates. Adds missing demo
stories, extends coverage enforcement, and publishes an example-app feature matrix.

- **Implementation plan:** [examples-demo-coverage.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/examples-demo-coverage.md)
- **Tasks:** [examples-demo-coverage.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/examples-demo-coverage.md)
- **RTK flag:** Partial
- **Depends on:** docs-reference-coverage

---

## web-ssr-and-admin-spa

**Title:** `[Roadmap] Web SSR and admin SPA`

**Labels:** `area:ui`, `type:feature`  
**Project fields:** Area=`ui`, Target=`Future`, Impact=`Feature`, IP=`web-ssr-and-admin-spa`, Status=`Planned`

Adds real server-side rendering for Terreno web apps so routes can be indexed and paint
meaningful HTML before JavaScript loads. Starts with static output and admin-spa as proving
ground; SSR is opt-in and depends on Expo SDK 55+.

- **Implementation plan:** [web-ssr-and-admin-spa.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/web-ssr-and-admin-spa.md)
- **Tasks:** [web-ssr-and-admin-spa.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/web-ssr-and-admin-spa.md)
- **RTK flag:** Partial
- **Depends on:** Expo SDK ≥ 55 (PR #779), deployment-foundation

---

## infra-mcp

*Outside the OSS launch program.*

**Title:** `[Roadmap] Infrastructure MCP server (@terreno/infra-mcp)`

**Labels:** `area:mcp`, `type:feature`, `status:blocked`  
**Project fields:** Area=`mcp`, Target=`Future`, Impact=`Feature`, IP=`infra-mcp`, Status=`Planned`

> Blocked on the RBAC permissions module. The Project **Status** field has no `Blocked`
> option, so gating is tracked with the `status:blocked` issue label instead.

Puts privileged infrastructure tooling — GCP, Sentry, MongoDB, and later Expo/EAS and Vercel —
behind one deployable MCP server with per-user OAuth 2.1 authentication, RBAC-driven read and
write tiers, per-call confirmation on write tools, and an audit trail. Read-only access covers
log digging without handing anyone production credentials, and the server runs on its own Cloud
Run runtime service account so injected service-account keys can be retired.

- **Implementation plan:** [infra-mcp.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/infra-mcp.md)
- **Tasks:** [infra-mcp.md](https://github.com/FlourishHealth/terreno/blob/master/docs/tasks/infra-mcp.md)
- **RTK flag:** None
- **Depends on:** rbac-permissions
