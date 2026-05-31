---
name: autobot
description: Run the requested work end-to-end, then invoke /submit so implementation, validation, commit, push, PR update, and CI watching happen from one command.
---
# Autobot

Run a requested implementation or fix all the way through submission. This skill is the one-command path for autonomous work: implement the requested change, validate it, and then run `/submit`.

## Instructions

1. Clarify only if the request is materially ambiguous.
   - If the task can be completed with reasonable assumptions, proceed.
   - If the request is only a question, answer it instead of changing files.

2. Implement the requested work.
   - Read the relevant code and rules first.
   - Preserve unrelated user changes.
   - Keep edits focused on the requested outcome.
   - Add or update tests when the change has meaningful behavior to validate.

3. Validate the result.
   - Run the most relevant lint, compile, test, or manual checks for the files changed.
   - If validation fails because of your changes, fix the issue and rerun the checks.
   - Remove temporary debugging code before submission.

4. Invoke `/submit`.
   - Pass a concise `$DESCRIPTION` that summarizes the completed work.
   - `/submit` handles pre-commit checks, staging, commit, push, PR create/update, and launching check-watcher.
   - Do not stop after implementation or testing unless blocked by a real issue that prevents submission.

## Arguments

$TASK: The implementation, fix, or maintenance task to complete and submit.
