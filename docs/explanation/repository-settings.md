# Repository settings (maintainers)

Some GitHub settings cannot be committed to the repo. Enable these manually in
the [Terreno repository settings](https://github.com/FlourishHealth/terreno/settings).

## Discussions

**Path:** Settings → General → Features → Discussions

Enable Discussions and create these categories (see
[public roadmap IP](../implementationPlans/public-roadmap-github.md) for
descriptions):

1. Announcements (maintainers only)
2. Q&A
3. Ideas
4. Agents & AI
5. RFCs
6. Show and tell
7. Docs feedback

## Security

**Path:** Settings → Security → Code security and analysis

- Enable **Private vulnerability reporting** (GitHub PVR as the primary channel;
  `security@terreno.app` is the email fallback — see [SECURITY.md](../../SECURITY.md))

## Branch protection (`master`)

**Path:** Settings → Branches → Branch protection rules → `master`

- Require a pull request before merging
- Require status checks to pass (include Repository policies, package CI, and
  Rulesync Check jobs relevant to the change)
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

### CircleCI checks

Package CI, policy, Playwright, Maestro web, architectural review, deploy, and
release workflows run under `.circleci/` (see
[how-to/circleci.md](../how-to/circleci.md)). Require the path-filtered CircleCI
check names. Remove required GitHub Action checks for workflow files whose
trigger is `on: []`; those checks cannot report anymore. Do not require the
config-only `circleci-config` workflow. Keep Cursor Approval / Security / Bugbot
as GitHub App checks; they are not CircleCI jobs.

## GitHub Environments (GCP preview)

**Path:** Settings → Environments

Same-repo PR jobs in `cd.yml` (`Terraform preview`, `Backend deploy (preview)`)
skip when `head.repo.full_name != github.repository`. Also restrict the
`gcp-cd-preview` environment (create it on first deploy if missing) with a
**deployment branch policy** or **required reviewers** so a fork that edits
`cd.yml` cannot mint a prod WIF token.

## Merge settings

**Path:** Settings → General → Pull Requests

- Allow **squash merging** only (disable merge commits and rebase merging)
- Enable **Automatically delete head branches** after merge
