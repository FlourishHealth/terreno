---
name: respond-to-review
description: >-
  Review PR comments, infer PR from branch when needed, plan fixes, and
  implement — auto-shipping when no clarifications are needed
---
# PR Review Response Workflow

Review comments on a PR resolved from `$ARGUMENTS` or the current branch, then plan fixes. If the plan has open questions for the user, pause for confirmation; otherwise implement, commit, and run `/shipit` automatically without prompting.

## Step 0: Validate Input

Resolve the PR number once at the start and store it in `PR_NUMBER`. All later shell and `gh` commands must use `PR_NUMBER`, not `$ARGUMENTS` directly.

- If `$ARGUMENTS` contains digits only: use it as `PR_NUMBER`.
  ```bash
  PR_NUMBER="$ARGUMENTS"
  ```
- If `$ARGUMENTS` is empty: try to find the PR for the current branch:
  ```bash
  BRANCH_NAME="$(git branch --show-current)"
  if [ -z "$BRANCH_NAME" ]; then
    echo "No PR number was provided and the current checkout is detached. Ask the user which PR to review."
    exit 1
  fi

  if ! PR_NUMBER="$(gh pr view "$BRANCH_NAME" --json number --jq '.number' 2>/dev/null)"; then
    echo "No PR was found for branch: $BRANCH_NAME"
    gh pr list --head "$BRANCH_NAME" --json number,title,url
    echo "Ask the user which PR to review."
    exit 1
  fi
  ```
- If `$ARGUMENTS` contains anything other than digits (whitespace, shell metacharacters, quotes, `..`, etc.): refuse to substitute it. Ask the user to re-invoke with a numeric PR number or no argument while checked out on the PR branch, then stop.

After resolving `PR_NUMBER`, confirm it is a positive integer before using it:

```bash
case "$PR_NUMBER" in
  ""|*[!0-9]*)
    echo "Resolved PR number is invalid: $PR_NUMBER"
    exit 1
    ;;
esac
```

Do not attempt to "clean up" or quote a non-numeric PR number — reject it.

## Step 1: Setup Working Directory

1. Check if we're already in a git worktree:
   ```bash
   git rev-parse --show-toplevel
   git worktree list
   ```

2. **If already in a worktree**, use the current directory — skip to Step 2.

3. **If NOT in a worktree**, set one up:

   a. Get the repo name:
      ```bash
      basename $(git rev-parse --show-toplevel)
      ```

   b. Fetch PR details and branch name:
      ```bash
      gh pr view "$PR_NUMBER" --json headRefName,number,title,url,author
      ```

   c. Fetch the PR branch:
      ```bash
      git fetch origin pull/$PR_NUMBER/head
      ```

   d. Create worktree at `~/.claude-worktrees/<repo-name>/pr-$PR_NUMBER`:
      ```bash
      git worktree add ~/.claude-worktrees/<repo-name>/pr-$PR_NUMBER FETCH_HEAD
      ```

   e. Change to the worktree directory:
      ```bash
      cd ~/.claude-worktrees/<repo-name>/pr-$PR_NUMBER
      ```

   f. Set up tracking for the PR branch:
      ```bash
      git checkout -B <branch-name> FETCH_HEAD
      git branch --set-upstream-to=origin/<branch-name>
      ```

**Important**: All subsequent work happens in the working directory (worktree or current).

## Step 2: Find the Reviews

1. Get review threads with resolution status using GraphQL. **Important**: capture the thread `id` for each unresolved thread so you can resolve them later.
   ```bash
   gh api graphql -f query='
     query($owner: String!, $repo: String!, $pr: Int!) {
       repository(owner: $owner, name: $repo) {
         pullRequest(number: $pr) {
           reviewThreads(first: 100) {
             nodes {
               id
               isResolved
               comments(first: 50) {
                 nodes {
                   author { login }
                   body
                   path
                   line
                   createdAt
                 }
               }
             }
           }
           reviews(first: 50) {
             nodes {
               author { login }
               state
               body
             }
           }
         }
       }
     }' -F owner=':owner' -F repo=':repo' -F pr="$PR_NUMBER"
   ```

2. **Ignore resolved threads entirely** — only process threads where `isResolved` is `false`

3. Filter to comments from other users (not the PR author)

4. Identify which remaining comments are:
   - Blocking (CHANGES_REQUESTED) vs suggestions
   - Inline code comments vs general comments

## Step 3: Decide What To Do & Propose a Plan

Decide the right action for each unresolved comment (fix, skip, ask), then present a structured plan organized by priority:

```
## PR #$PR_NUMBER Review Comments Plan

### 🔴 Must Fix (Blocking)
1. [file:line] @reviewer: "comment text"
   → Proposed fix: <description>

### ⚠️ Should Address (Suggestions)
2. [file:line] @reviewer: "comment text"
   → Proposed fix: <description>

### 💬 Questions/Clarifications Needed
- Comment X: Need your input on approach
- Comment Y: Conflicts with existing pattern, which to use?

### 📝 Will Skip (N/A or out of scope)
- Comment Z: Not applicable or out of scope

### 💬 Suggested Replies to Human Commenters
For any comments that warrant a reply (e.g., to clarify a decision or thank a reviewer):
- **Print the suggested reply text** so the user can see it
- **Never post replies** via `gh pr comment`, `gh api`, or any other method — leave posting to the user
```

## Step 4: Confirmation (only if there are open questions)

**If the plan has any items under 💬 Questions/Clarifications Needed:**
Ask: **"Need your input on the questions above. Anything else to change before I implement?"**
- Wait for explicit approval before making any changes
- Incorporate any feedback
- Re-present plan if significant changes requested

**If there are no open questions:** skip confirmation entirely. Proceed directly to Step 5 — implement, commit, run `/shipit`, and resolve threads without further prompts. Do not ask the user for plan approval in this case.

## Step 5: Make the Fix

After approval:

1. Implement fixes one at a time, in priority order
2. After each fix, briefly confirm what was changed

## Step 6: Show the diff

Show the complete diff so the user can scan what was implemented:
```bash
git diff
git diff --stat
```

Do **not** commit here. `/shipit` (next step) handles pre-commit checks, staging, commit, push, and PR updates — running pre-commit *before* the commit, which is the correct order. Committing here would invert that order and leave broken code committed locally if pre-commit fails.

## Step 7: Run /shipit

Invoke the `/shipit` skill to handle pre-commit checks, commit, push, PR updates, CI monitoring, and bot review handling. Pass a `$DESCRIPTION` summarizing what review comments were addressed so the commit message reflects the work.

## Step 8: Resolve Addressed Threads

After `/shipit` completes, resolve each review thread that was addressed in the implementation. Use the thread `id` captured in Step 2.

For each thread that was fixed or addressed (from the "Must Fix" and "Should Address" categories in the plan):
```bash
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }' -f threadId="<thread_id>"
```

Do NOT resolve threads that were:
- Skipped (marked as N/A or out of scope)
- Questions/clarifications that were not answered by code changes
- Threads where the user decided not to take action

Report which threads were resolved and which were left open.

---

## Error Handling

- If worktree already exists, ask if user wants to reset it or use existing
- If PR not found, show error and available PRs: `gh pr list`
- If no comments found, inform user and ask if they want to proceed anyway
- If merge conflicts occur during implementation, pause and ask for guidance

## Cleanup Reminder

If a new worktree was created, remind user:
```
To remove this worktree later:
  git worktree remove ~/.claude-worktrees/<repo>/pr-$PR_NUMBER

Or to keep working on it, you can open a new Claude session in:
  cd ~/.claude-worktrees/<repo>/pr-$PR_NUMBER
```
