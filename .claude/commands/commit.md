# Commit Changes

Create a commit for the current staged/unstaged changes.

## Instructions

1. First, run linting at the repo root:
   ```
   cd /Users/joshgachnang/src/terreno && PATH="$HOME/.bun/bin:$PATH" bun lint
   ```

2. If linting fails, fix the issues before proceeding.

3. Check git status and diff to understand what changed:
   ```
   git status
   git diff
   git diff --cached
   ```

4. Stage changes appropriately and create a commit:
   - Review the actual changes to write an accurate commit message
   - Use conventional commit format (feat:, fix:, chore:, docs:, refactor:, test:)
   - Keep the first line under 72 characters
   - Add a body if more context is needed

5. Push the branch to origin:
   ```
   git push origin HEAD
   ```

## Arguments

$DESCRIPTION: Optional description to guide the commit message
