# Submit Changes

Create a commit and pull request for the current changes.

## Instructions

1. First, run linting at the repo root to ensure code quality:
   ```
   cd /Users/joshgachnang/src/terreno && PATH="$HOME/.bun/bin:$PATH" bun lint
   ```

2. If linting fails, fix the issues before proceeding.

3. Check git status to see what files have changed:
   ```
   git status
   git diff --stat
   ```

4. Stage all changes and create a commit with a descriptive message based on the changes:
   - Review the actual changes to understand what was modified
   - Write a clear, concise commit message summarizing the changes
   - Use conventional commit format if appropriate (feat:, fix:, chore:, etc.)

5. Push the branch to origin:
   ```
   git push origin HEAD
   ```

6. Create a pull request using the GitHub CLI:
   ```
   gh pr create --title "<descriptive title>" --body "<summary of changes>"
   ```
   - The title should be clear and descriptive
   - The body should summarize what changed and why
   - Include any relevant context for reviewers

7. Return the PR URL to the user.

## Arguments

$DESCRIPTION: Optional description of the changes to include in the commit message and PR
