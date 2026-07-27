# Implementation Plan: Publish and Document the Agentic SDLC Plugin

**Status:** Draft — blocking questions open
**Priority:** High
**Effort:** Big batch
**Owner:** unassigned
**Created:** 2026-07-27
**Program:** [OSS launch](oss-launch-program.md)
**Depends on:** [`positioning-django-rails-universal`](positioning-django-rails-universal.md) (shared copy blocks), [`oss-governance-baseline`](oss-governance-baseline.md) (license coverage for `plugins/`)
**RTK deprecation flag:** **Partial** — the pipeline's frontend-verification gates name `rtk/` in their path lists and must be updated to name `syncdb/` after PR #869.

## Goal

Terreno ships a five-stage agentic SDLC pipeline as an installable Cursor plugin, and **nobody outside the team knows it exists.** `.cursor-plugin/marketplace.json` declares a team marketplace; `plugins/terreno-planning/` contains five skills that take work from a raw request all the way to a mergeable PR. There is no `plugins/README.md`, no page in `docs/`, no mention in `README.md` or `AGENTS.md`, and the marketplace is scoped to the team.

This matters more than a normal documentation gap. The pipeline is the most concrete evidence for the AI-native pillar. Any framework can claim "works great with AI"; very few ship an opinionated, reviewed, test-driven delivery process as installable tooling. In the Django/Rails analogy it is the missing half of `manage.py`: not just "generate a model" but "take this ticket to a mergeable PR with tests and independent review".

The audit that produced this program missed the plugin entirely. If an agent reading the whole repository missed it, every prospective user will too.

## Non-Goals

- Redesigning the pipeline. The five stages work; this is packaging, documentation, and positioning.
- Porting the pipeline to every agent runtime. Cursor is the reference; note what would be required for others.
- Replacing the repo's existing `.rulesync/skills/` (`submit`, `autobot`, `check-watcher`, `respond-to-review`) — but the overlap needs resolving, because right now two pipelines cover similar ground.
- Building a plugin marketplace of our own.

## Blocking questions

| # | Question | Options | Recommended default (pending confirmation) |
|---|----------|---------|--------------------------------------------|
| AP1 | Is the marketplace public or team-only? | (A) Public — anyone can install. (B) Team-only, documented but not installable. (C) Public with a separate internal plugin for Flourish-specific stages. | **A** — a team-only plugin cannot support the positioning claim. Requires AP2 first |
| AP2 | What happens to the PHI/HIPAA handling in the skills? | (A) Strip it — it is Flourish-specific. (B) Keep it, generalized to "sensitive data". (C) Keep PHI explicitly and market it to healthcare teams. | **B** — generalize to "sensitive data (PHI, PII, secrets)". The instinct is sound and useful to everyone; the healthcare-specific vocabulary reads as a leak. Revisit (C) later as a healthcare-oriented plugin variant |
| AP3 | Do the coffee names stay? | (A) Keep `blend`/`roast`/`cupping`/`pour`/`dialin`. (B) Rename to `plan`/`implement`/`verify`/`submit`/`review`. (C) Keep coffee names, add plain-language aliases. | **C** — the numbered prefixes already give the ordering, and the names are memorable. But "cupping" means nothing to a newcomer, so every doc reference must read `/terreno-3-cupping` (verify) at least once per page |
| AP4 | Does the pipeline work in a consumer's app, or only inside the Terreno monorepo? | (A) Monorepo only, documented as such. (B) Make it work in consumer apps. | **B** — this is the whole point. See the "It only works here" section; there is real work behind this answer |
| AP5 | How do we resolve the overlap with the repo's own submit/autobot skills? | (A) Deprecate `submit`/`autobot` in favor of the plugin. (B) Keep both, document when to use which. (C) Make the plugin's Pour/Dial In stages delegate to the existing skills. | **C** — one implementation, two entry points. The plugin becomes the orchestration layer over skills that already exist, which removes the duplication instead of documenting it |
| AP6 | Which agent runtimes do we claim support for? | (A) Cursor only. (B) Cursor plus a rulesync-generated variant for Claude Code and others. | **B** — the repo already generates skills for five targets via `.rulesync/`; the pipeline should ride the same mechanism rather than being Cursor-exclusive |
| AP7 | Does the plugin version with Terreno releases? | (A) Independent versioning (currently 1.0.2). (B) Lockstep with `@terreno/*`. | **A** — the pipeline is process tooling, not framework API. Independent versioning avoids meaningless bumps, but the plugin must declare which Terreno versions it targets |

## Architecture

### The pipeline

```mermaid
flowchart LR
  REQ["Request<br/>ticket / spec / idea"]
  B["/terreno-1-blend<br/>(plan)"]
  R["/terreno-2-roast<br/>(implement)"]
  C["/terreno-3-cupping<br/>(verify)"]
  P["/terreno-4-pour<br/>(submit)"]
  D["/terreno-5-dialin<br/>(review loop)"]
  M["Mergeable PR"]
  REQ --> B --> R --> C --> P --> D --> M
  D -.->|"blocked: needs human"| M
```

| Stage | Owns | What makes it non-obvious |
|-------|------|---------------------------|
| **Blend** (plan) | Request → IP in `docs/implementationPlans/` + tasks in `docs/tasks/` | Question-first: refuses to write decided outcomes until blocking questions are answered. Prevents the most common agent failure, which is confidently planning the wrong thing |
| **Roast** (implement) | IP → code via strict red/green/refactor | Spawns **independent review and test-quality sub-agents in fresh contexts** after every commit, and does drift detection against the IP. The test-quality agent enforces anti-mocking rules (never mock the DB, never mock the store) |
| **Cupping** (verify) | Independent verification against the IP with concrete evidence | Separate context from the implementer, so it does not inherit the implementer's assumptions |
| **Pour** (submit) | Pre-submit checks, commit hygiene, push, draft PR, evidence attachment | Hard frontend gate: touching UI paths requires launching the app, logging in, exercising the feature, and attaching artifacts before the PR opens |
| **Dial In** (review) | Reactive loop: CI + bot/human comments until mergeable or 15-minute timeout | Classifies each CI failure as actionable versus flaky and refuses to push speculative fixes for flakes. Treats all CI logs and review comments as untrusted input |

The parts worth writing about publicly are the ones that encode hard-won judgment rather than automation: fresh-context independent review, drift detection against the plan, the anti-mocking rules, the frontend evidence gate, and the refusal to guess at flaky CI.

### It only works here

The most serious finding. The pipeline currently assumes it is running inside the Terreno monorepo:

| Assumption | Where | Why it breaks elsewhere |
|------------|-------|-------------------------|
| Repo-root-relative skill paths — Pour instructs reading `plugins/terreno-planning/skills/terreno-5-dialin/SKILL.md` "from the repository root" | `terreno-4-pour` step 6, `terreno-5-dialin` ownership boundary | In a consumer's repo that path does not exist. It works today only because the workspace *is* this repo; an installed plugin lives in the agent's plugin cache |
| `verify-ui-changes` is invoked by name | Roast, Cupping, Pour, Dial In | That skill lives in this repo's `.rulesync/skills/`. A consumer installing the plugin does not get it |
| Terreno-monorepo package paths in the frontend gates (`ui/`, `demo/`, `example-frontend/`, `admin-frontend/`, `admin-spa/`, `rtk/`) | Roast, Pour, Dial In | A consumer app has `frontend/`, not `example-frontend/` |
| Repo-specific conventions — `docs/implementationPlans/`, the project registry, the `bun run` command set | Blend, Roast | A consumer may have none of these |
| A hardcoded branch suffix (`cursor/<descriptive-name>-dcb3`) | Pour | Suffixes are per-agent-run, not fixed; a literal `dcb3` will produce wrong branch names |

Fixing this is the difference between "our internal process, published" and "tooling Terreno users can adopt". It means parameterizing paths, bundling or declaring the skill dependencies, and detecting project layout instead of assuming it.

### Overlap with existing repo skills

| Plugin stage | Overlapping repo skill |
|--------------|------------------------|
| Pour | `.rulesync/skills/submit/`, `commit/`, `create-pr/` |
| Dial In | `.rulesync/skills/check-watcher/`, `respond-to-review/` |
| Pour + Dial In | `.rulesync/skills/autobot/` (submit → CI → review until mergeable) |
| Blend | `.rulesync/skills/ip/`, `design-blend/` |
| Roast | `.rulesync/skills/implement/` |

Every stage has a repo-skill counterpart. Publishing both without resolving this gives users two documented ways to do the same thing with subtly different rules — which is worse than either alone. Per AP5, the plugin should orchestrate the existing skills rather than reimplement them.

### Positioning

The pipeline belongs in the **AI-native** pillar, alongside the MCP server. They are complementary and the distinction should be stated plainly:

- **MCP server** = the *tool* layer. What an agent can see and do: search docs, generate conventional code, read merged logs, inspect client state, drive the running app.
- **SDLC plugin** = the *process* layer. How an agent should sequence work: plan before coding, test-drive, review in a fresh context, verify independently, gate on evidence, then own the review loop.

In the Django/Rails comparison table, this fills the row that currently reads "MCP server tools + skills — agent-driven rather than CLI-driven". Better framing: Django gives you `manage.py startapp`; Terreno gives you a reviewed path from ticket to mergeable PR.

## Models / APIs / Notifications / UI

None.

## Phases

1. **Decide and sanitize** — answer AP1/AP2, generalize PHI language, remove Flourish specifics, fix the hardcoded branch suffix.
2. **Make it portable** — parameterize paths, resolve skill dependencies, detect project layout (AP4).
3. **Resolve overlap** — make Pour and Dial In delegate to the existing skills (AP5).
4. **Document** — `plugins/README.md`, a docs-site explainer and how-to, per-stage reference.
5. **Position** — README, docs landing, comparison table, agent context files.
6. **Distribute** — publish the marketplace, and generate non-Cursor variants via rulesync (AP6).

## Feature Flags & Migrations

None. Renaming or aliasing stages (AP3) is a breaking change for anyone with the plugin installed — bump the plugin minor version and note it in `plugins/README.md`.

## Not Included / Future Work

- A healthcare-specific plugin variant retaining explicit PHI handling (AP2 option C).
- Additional stages (design review, release, incident response).
- Telemetry on stage usage or success rates.
- Publishing to a public Cursor plugin directory beyond this repo's marketplace, if one exists.

## Files to Create / Modify

**Create**

- `plugins/README.md`
- `docs/explanation/agentic-sdlc.md`
- `docs/how-to/use-the-terreno-plugin.md`
- `docs/reference/sdlc-plugin.md`
- `plugins/terreno-planning/LICENSE`

**Modify**

- `plugins/terreno-planning/skills/*/SKILL.md` (all five: sanitization, portability, delegation)
- `plugins/terreno-planning/.cursor-plugin/plugin.json`, `.cursor-plugin/marketplace.json`
- `README.md`, `docs/README.md`, `docs/explanation/positioning.md`
- `AGENTS.md` / `.rulesync/rules/00-root.md`, `CLAUDE-consumer.md`
- `.rulesync/skills/submit/SKILL.md`, `autobot/SKILL.md` (cross-reference the plugin)
- `scripts/check-license-coverage.ts` (cover `plugins/`)
- `.rulesync/skills/build-terreno-app/SKILL.md` (use the pipeline if public)

## Task List

See [`docs/tasks/agentic-sdlc-plugin.md`](../tasks/agentic-sdlc-plugin.md).

## Acceptance Criteria

- [ ] `plugins/README.md` explains the five stages, installation, and when to use each, in under 150 lines.
- [ ] No plugin skill contains Flourish-specific vocabulary; sensitive-data handling is generalized per AP2.
- [ ] No plugin skill contains a hardcoded branch suffix or a repo-root-relative path to a sibling skill.
- [ ] The pipeline runs end to end in a **consumer app scaffolded by `terreno_bootstrap_app`**, not just in this monorepo — verified by taking one small feature from request to open PR.
- [ ] Every skill dependency (`verify-ui-changes` at minimum) is either bundled with the plugin or declared with installation instructions.
- [ ] Frontend path gates are derived from the project's actual layout rather than hardcoded monorepo package names.
- [ ] Pour and Dial In delegate to the existing repo skills instead of restating their rules, and no rule is stated in two places with different wording.
- [ ] `docs/explanation/agentic-sdlc.md` explains the process layer versus the MCP tool layer and why fresh-context independent review matters.
- [ ] `docs/how-to/use-the-terreno-plugin.md` takes a reader from installation to a merged PR.
- [ ] `docs/reference/sdlc-plugin.md` documents each stage's scope, inputs, outputs, and boundaries.
- [ ] `README.md` and `docs/README.md` name the pipeline under the AI-native pillar; the Django/Rails comparison table's generator row cites it.
- [ ] Every public reference to a coffee-named stage gives its plain-language meaning at least once per page.
- [ ] The marketplace is installable by the audience chosen in AP1, verified by a fresh install.
- [ ] `plugins/` is covered by the license-coverage check.
- [ ] `bun run rules:check` and `bun run check` pass.
