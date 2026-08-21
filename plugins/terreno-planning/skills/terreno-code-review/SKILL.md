---
name: terreno-code-review
description: Review a branch against repository standards and its originating IP/spec in two independent axes. Use from Brew or when explicitly asked to review implementation changes before PR submission.
disable-model-invocation: true
---

# Terreno code review

Review the diff from a pinned merge-base to `HEAD` without changing code. Keep standards and spec findings separate so correctness in one axis cannot hide failure in the other.

## 1. Pin the review range

Resolve the fixed point supplied by the caller. Brew uses the PR base branch, or the repository default branch when no PR exists.

```bash
git rev-parse <fixed-point>
git diff <fixed-point>...HEAD
git log <fixed-point>..HEAD --oneline
```

Stop with a clear result when the ref is invalid or the diff is empty.

## 2. Resolve the spec

Use the first available source:

1. IP paths linked from the PR body or commit messages.
2. Changed or matching files under `docs/implementationPlans/` and `docs/tasks/`.
3. A spec path supplied by the caller.

If no spec exists, report `No spec available` for the spec axis; do not invent one.

## 3. Resolve standards

Read the instructions that apply to changed paths:

- `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/`
- package-local guidance
- relevant skill contracts, especially schema safety, prompt governance, docs, and frontend verification

Tool-enforced formatting is outside review scope. Focus human review on behavior, architecture, security, tests, and documented conventions.

## 4. Run independent axes

Spawn two fresh review sub-agents in parallel when the harness supports them. Give both the exact diff command and commit list.

### Standards reviewer

Ask for every material documented-standard breach with the rule source and changed hunk. Also assess these judgment-call smells:

- duplicated logic
- mysterious names
- data clumps or primitive obsession
- repeated conditionals
- shotgun surgery or divergent change
- speculative generality
- message chains or middle-men

Repository standards override the smell baseline. Require concrete file/hunk evidence and skip style already enforced by tooling.

### Spec reviewer

Give it the complete IP/spec and task list. Ask for:

- missing or partial requirements
- behavior not requested by the spec
- requirements implemented incorrectly
- tests or documentation promised but absent

Require a quoted spec requirement and concrete diff evidence for every finding.

If parallel sub-agents are unavailable, run both passes sequentially in the current fresh review context and preserve the separation.

## 5. Report

Return:

```markdown
## Standards
<findings, or "No material findings">

## Spec
<findings, "No material findings", or "No spec available">

Summary: <count> standards finding(s); <count> spec finding(s).
```

Rank severity only within each axis. A clean review requires no unresolved material findings in either available axis.
