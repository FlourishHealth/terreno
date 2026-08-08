# Public roadmap process

Terreno runs its **public roadmap on GitHub** and keeps **sprint execution in Linear**.
Implementation plans in `docs/implementationPlans/` remain the design source of truth for
both.

- **GitHub** — discussions, triaged issues, the Terreno Roadmap project board, generated
  [`ROADMAP.md`](../../ROADMAP.md)
- **Linear** — estimates, assignees, sprint workflow (internal)
- **IPs** — approved design docs before substantial cross-package work

See also [CONTRIBUTING.md](../../CONTRIBUTING.md) for the contributor intake flow.

## Maintainer setup

> **Human action required.** Cloud agents cannot mutate GitHub org/repo settings. Run these
> steps once per environment.

### Enable Discussions

1. GitHub → **Settings** → **General** → **Features** → enable **Discussions**.
2. Create the categories below in **Discussions** → **⚙️ Categories** (display order top to
   bottom).

| Order | Name | Format | Who can post | Description (paste into GitHub) |
| ----- | ---- | ------ | ------------ | --------------------------------- |
| 1 | Announcements | Announcement | Maintainers only | Official release notes, breaking changes, deprecations, and launch updates from the Terreno team. |
| 2 | Q&A | Question / Answer | Anyone | Ask how to use Terreno. Search existing threads first; accepted answers may become how-to guides in `docs/how-to/`. |
| 3 | Ideas | Open-ended | Anyone | Feature ideas and improvements before they are shaped. This is the intake funnel — do not open a tracking issue until a maintainer promotes your idea. |
| 4 | Agents & AI | Open-ended | Anyone | MCP setup, Cursor/Claude skills, agent workflows, and prompt patterns for building with Terreno. |
| 5 | RFCs | Open-ended | Anyone | Substantial proposals that change public API or add packages. Use the RFC discussion template; accepted RFCs become IPs. |
| 6 | Show and tell | Open-ended | Anyone | Apps and experiments built with Terreno. Share what you shipped and what friction you hit. |
| 7 | Docs feedback | Open-ended | Anyone | Report missing or confusing documentation. Link the page URL; recurring feedback becomes docs PRs. |

### Pinned posts

Pin one intro post per category after creation. Bodies below are ready to paste.

#### Announcements

```markdown
Release announcements, breaking changes, and deprecation notices land here.

- Do **not** file support bugs as announcements — use [Issues](https://github.com/FlourishHealth/terreno/issues/new/choose) or Q&A.
- Security issues: see [SECURITY.md](https://github.com/FlourishHealth/terreno/blob/master/SECURITY.md) (private report only).
```

#### Q&A

```markdown
Ask **how** to use Terreno — setup, APIs, deployment, agents.

1. Search [existing Q&A](https://github.com/FlourishHealth/terreno/discussions/categories/q-a) and the [docs site](https://terreno-docs.netlify.app/).
2. For step-by-step guides, start with [`docs/how-to/`](https://github.com/FlourishHealth/terreno/tree/master/docs/how-to).
3. Bug reports belong in [Bug report issues](https://github.com/FlourishHealth/terreno/issues/new?template=bug_report.yml), not here.

When an answer repeats, maintainers turn it into a how-to doc via PR.
```

#### Ideas

```markdown
**Ideas are the intake funnel.** Share problems and rough solutions before they become roadmap items.

- Do **not** open a feature issue directly — maintainers promote accepted ideas to tracked issues on the [Terreno Roadmap](https://github.com/FlourishHealth/terreno/projects) board.
- For API/package-level design, use the **RFCs** category instead.
- Bugs → [Bug report](https://github.com/FlourishHealth/terreno/issues/new?template=bug_report.yml).
```

#### Agents & AI

```markdown
MCP server setup, Cursor/Claude skills, and agent-driven workflows.

- MCP package: [`mcp-server/`](https://github.com/FlourishHealth/terreno/tree/master/mcp-server) and hosted `terreno-mcp`.
- Agent skills: [`.rulesync/skills/`](https://github.com/FlourishHealth/terreno/tree/master/.rulesync/skills) (mirrored to `.cursor/`, `.claude/`, etc.).
- Terreno planning plugin: [`plugins/terreno-planning/`](https://github.com/FlourishHealth/terreno/tree/master/plugins/terreno-planning).

General feature ideas → **Ideas**. Doc typos → **Docs feedback** or a docs PR.
```

#### RFCs

```markdown
Propose changes to **public API**, **new published packages**, or **cross-package architecture**.

Use the [RFC template](https://github.com/FlourishHealth/terreno/discussions/new?category=rfcs) (Summary, Motivation, Design, Alternatives).

Accepted RFCs become implementation plans in `docs/implementationPlans/` before large code changes. Small bugs and docs fixes do not need an RFC.
```

#### Show and tell

```markdown
Show what you built with Terreno — screenshots, repos, and lessons learned welcome.

Friction you discover may become Ideas, bugs, or docs PRs. This category is for celebration and learning, not support tickets.
```

#### Docs feedback

```markdown
Report missing, outdated, or confusing documentation.

Include the **page URL** (docs site or `docs/` path). For quick fixes, open a PR instead.

Every docs page also has a **Discuss this page** link in the footer.
```

### Project board

Create one GitHub Project named **Terreno Roadmap** (repo-level is fine; org-level also
works). Link it to `FlourishHealth/terreno`.

**Fields** (single-select unless noted):

| Field | Type | Options |
| ----- | ---- | ------- |
| Status | Single select | `Inbox`, `Shaping`, `Planned`, `In progress`, `In review`, `Shipped`, `Declined` |
| Area | Single select | `api`, `ui`, `syncdb`, `auth`, `admin`, `ai`, `mcp`, `docs`, `deploy`, `examples`, `dx` |
| Target | Single select | `0.28`, `0.29`, `Next`, `Future` (add version labels as releases approach) |
| IP | Text | Slug e.g. `web-ssr-and-admin-spa` (empty when no IP yet) |
| Impact | Single select | `Breaking`, `Feature`, `Improvement`, `Fix` |
| Community interest | Number | 👍 count — refresh manually on triage |

**Views**

1. **Roadmap** — Board layout, group by `Status`, filter `Status != Declined` (default public view).
2. **By area** — Table, group by `Area`.
3. **Next release** — Table, filter `Target = Next` (update filter when cutting a release).
4. **Needs shaping** — Table, filter `Status = Shaping`.

**CLI (partial support)**

```bash
gh project list --owner FlourishHealth --limit 20
gh project link <project-number> --owner FlourishHealth --repo FlourishHealth/terreno
```

Field and view creation is **UI-only** today — recreate the tables above in the Project
settings.

**Backfill:** paste tracking issues from [`roadmap-seed-issues.md`](roadmap-seed-issues.md)
when each IP reaches **Approved**.

### Labels

[`.github/labels.yml`](../../.github/labels.yml) is the source of truth.

Apply or update labels:

```bash
while IFS= read -r line; do
  name=$(echo "$line" | sed -n 's/^- name: \(.*\)/\1/p' | tr -d '"')
  color=$(echo "$line" | sed -n 's/^  color: "\(.*\)"/\1/p')
  desc=$(echo "$line" | sed -n 's/^  description: "\(.*\)"/\1/p' | tr -d '"')
  if [ -n "$name" ] && [ -n "$color" ]; then
    gh label create "$name" --color "$color" --description "$desc" --force
  fi
done < .github/labels.yml
```

Delete unused GitHub defaults after the new taxonomy is applied (`gh label list`).

### Secrets for roadmap generation

| Name | Purpose |
| ---- | ------- |
| `TERRENO_PROJECT_NUMBER` | GitHub Project number for **Terreno Roadmap** |
| `GITHUB_TOKEN` | Actions token or PAT with `project: read` + `contents: write` |

## Linear bridge

| Artifact | System of record |
| -------- | ---------------- |
| Public discussion, prioritization debate | GitHub Discussions |
| Triaged work items, roadmap columns | GitHub Issues + Project |
| Design scope, acceptance criteria | `docs/implementationPlans/*.md` |
| Sprint estimates, assignees, internal-only work | Linear |

**GitHub → Linear (one-way intake)**

1. Maintainer adds the `tracked` label to a GitHub issue.
2. Linear's GitHub integration imports the issue into the Terreno Linear team.
3. Title and description sync on creation; **status is not synced back**.

**Closing the loop:** merging PRs use `Fixes #NNN` so GitHub closes the issue and the board
item moves to `Shipped`. Closing Linear alone does **not** change GitHub state.

**Internal → public:** open a GitHub issue manually and paste the Linear URL. Internal-only
Linear work is never mirrored.

**Why not two-way status sync?** Bidirectional sync produces confusing loops between board
columns and sprint state. One-way intake plus `Fixes #NNN` keeps public state accurate.

Configure Linear: **Settings → Integrations → GitHub** → import issues with label `tracked`.

## One-time backfill

```bash
gh issue list --state open --limit 200 --json number,title,labels,updatedAt
```

For each issue: assign `area:*` + `type:*`, add to board as `Inbox` if relevant, or
`status:wontfix` / close if stale (> 6 months, no longer applies). A human must run this —
do not claim completion until done.

## Automation in this repo

| Workflow | Trigger | Purpose |
| -------- | ------- | ------- |
| [`.github/workflows/triage.yml`](../../.github/workflows/triage.yml) | Issue opened | `status:needs-triage` + `area:*` from package dropdown |
| [`.github/workflows/roadmap-generate.yml`](../../.github/workflows/roadmap-generate.yml) | Daily + manual | Regenerate `ROADMAP.md` from the Project board |

```bash
GITHUB_TOKEN=... TERRENO_PROJECT_NUMBER=... bun run roadmap:generate
```
