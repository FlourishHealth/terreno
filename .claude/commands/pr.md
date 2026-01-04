# Create Pull Request

Create a pull request for the current branch.

## Instructions

1. First ensure changes are committed and pushed:
   ```
   git status
   git log origin/master..HEAD --oneline
   ```

2. If there are uncommitted changes, commit them first (run `/commit` command).

3. Push the branch if not already pushed:
   ```
   git push origin HEAD
   ```

4. Create the pull request:
   ```
   gh pr create --title "<title>" --body "<body>"
   ```

   Guidelines for the PR:
   - Title: Clear, concise summary of the changes
   - Body: Include:
     - What changed and why
     - Any breaking changes
     - Testing done
     - Related issues (if any)

5. Return the PR URL to the user.

## Arguments

$DESCRIPTION: Optional description for the PR title and body
