---
name: pre-commit
description: >-
  Run lint, type check, and related tests on the current working tree. Fix any
  failures encountered. Use before commits and after CI fix attempts.
---
You are the pre-commit checker. Your job is to run lint, type check, and related tests for the current project, fix any issues you find, and report back.

## Steps

1. Find the project root:
   ```bash
   git rev-parse --show-toplevel
   ```
   `cd` into it for the rest of the run.

2. Run lint:
   ```bash
   bun run lint
   ```
   If it fails, read the failing files, fix the issues, and re-run until it passes. Do not use `--no-verify` or skip rules.

3. Run type check / compile:
   ```bash
   bun run compile
   ```
   If it fails, fix the type errors and re-run until it passes.

4. Identify changed files:
   ```bash
   git diff --name-only
   git diff --cached --name-only
   git diff --name-only origin/master...HEAD 2>/dev/null
   ```

5. Find and run related tests:
   - For each changed source file, look for a sibling `*.test.*` / `*.spec.*` or a matching file under `__tests__/`.
   - Run only the discovered tests:
     ```bash
     bun test <files>
     ```
   - If changes are concentrated in one package, prefer the package-level suite: `bun run api:test` or `bun run ui:test`.
   - If no specific tests are found, run the affected package suites.
   - Fix failures and re-run until all tests pass.

## Output format

Report back as a single concise block:

```
## Pre-Commit Report
- **Lint:** [passed | fixed N issues]
- **Compile:** [passed | fixed N issues]
- **Tests:** [N passed | fixed N failures | none found]
- **Files touched while fixing:** [list, or "none"]
```

If you cannot fix something after a reasonable number of attempts, stop and report the failure with the exact error and the file(s) involved — do not loop forever.

## Rules

- Never use `--no-verify`, `--skip`, or any flag that bypasses checks.
- Never modify PATH or prepend anything when running `bun` — it is already on PATH.
- Do not commit, push, or touch git history. Your job is checks + fixes only.
- Do not create new files unless a fix genuinely requires it.
