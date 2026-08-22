---
name: ip
description: >-
  Terreno repository conventions for implementation plans and task files.
  Lifecycle composition: Grow. `/ip` is a deprecated compatibility entry that
  routes planning method to `terreno-1-grow`.
disable-model-invocation: true
---
# Terreno IP conventions (`/ip` compatibility)

Grow owns portable research, grilling, shaping, approval, and result emission. This
repo-local skill supplies Terreno's artifact conventions.
Invoke it explicitly; generated agent formats that cannot encode
`disable-model-invocation` must still treat it as user-invoked only.

When invoked as `/ip`:

1. Load/invoke `terreno-1-grow` from the installed planning plugin.
2. Provide the request/PRD plus these repository conventions.
3. Return Grow's structured result unchanged.
4. If the plugin is unavailable, return `BLOCKED`; do not run a parallel planning method.

## Artifacts

- IP: `docs/implementationPlans/<slug>.md`
- Tasks: `docs/tasks/<slug>.md`
- Status lives in the IP header; there is no shared plan index.
- External roadmap/Linear/Discussion artifacts link to the IP/tasks and never replace
  them.
- Completed/killed IPs and task files move to matching `archive/` directories. Deferred
  plans stay in place with `**Status:** Deferred`.

## Terreno plan requirements

- Header: status, created date, author/owner, and applicable external links
- Goal, scope, explicit non-scope, architecture, models/APIs, rollout/migration risks
- Human decisions and assumptions
- Testable acceptance criteria paired with verification methods
- Relevant repo-local skills for affected domains
- Tracer-bullet tasks with files/seams, acceptance, verification, and explicit blockers

Use `docs/implementationPlans/README.md` and `docs/tasks/README.md` as the authoritative
format. Prefer revising an existing matching IP over creating a duplicate; ask before
overwriting Approved/In Progress plans.

## Project resolution

The current repository is the default. For explicit cross-repository planning, resolve
the repository/default branch through the available Git provider and current run
instructions rather than a hardcoded local directory or branch name.

## Submission

IP-only documentation changes use the repository `commit` and `create-pr` skills. Brew is
reserved for Roast-verified implementation work.
