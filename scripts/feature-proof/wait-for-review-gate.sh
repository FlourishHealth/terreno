#!/usr/bin/env bash
# Poll until CI checks and bot PR reviews are complete (pass or fail).
#
# Usage:
#   ./scripts/feature-proof/wait-for-review-gate.sh [pr-number]

set -euo pipefail

PR_NUMBER="${1:-$(gh pr view --json number -q .number 2>/dev/null || true)}"
if [ -z "$PR_NUMBER" ]; then
  echo "::error::No PR number" >&2
  exit 1
fi

MAX_WAIT_MINUTES="${MAX_WAIT_MINUTES:-10}"
INTERVAL_SEC="${INTERVAL_SEC:-30}"
deadline=$(( $(date +%s) + MAX_WAIT_MINUTES * 60 ))

bot_logins='["cursor","cursor[bot]","copilot-pull-request-reviewer","github-copilot[bot]"]'

pending_review_checks() {
  gh pr checks "$PR_NUMBER" --json name,state --jq \
    '[.[] | select(.state == "IN_PROGRESS" or .state == "PENDING") | select(.name | test("bugbot|cursor|copilot"; "i")) | .name]'
}

unresolved_bot_threads() {
  gh api graphql -f query='
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 1) {
                nodes { author { login } }
              }
            }
          }
        }
      }
    }' \
    -F owner="$(gh repo view --json owner -q .owner.login)" \
    -F repo="$(gh repo view --json name -q .name)" \
    -F pr="$PR_NUMBER" | jq --argjson bots "$bot_logins" '
      .data.repository.pullRequest.reviewThreads.nodes
      | map(select(.isResolved == false))
      | map(.comments.nodes[0].author.login)
      | map(select(. as $login | $bots | index($login)))
      | length'
}

while [ "$(date +%s)" -lt "$deadline" ]; do
  if ! pending=$(pending_review_checks); then
    echo "Failed to fetch PR checks, retrying in ${INTERVAL_SEC}s..."
    sleep "$INTERVAL_SEC"
    continue
  fi

  if ! bot_threads=$(unresolved_bot_threads); then
    echo "Failed to fetch review threads, retrying in ${INTERVAL_SEC}s..."
    sleep "$INTERVAL_SEC"
    continue
  fi

  pending_count=$(echo "$pending" | jq 'length')

  if [ "$pending_count" -eq 0 ]; then
    echo "Review gate: no pending bot/copilot checks (unresolved bot threads: ${bot_threads})"
    exit 0
  fi

  echo "Waiting for review checks: $(echo "$pending" | jq -r '.[]' | paste -sd ', ' -)"
  sleep "$INTERVAL_SEC"
done

echo "::error::Timed out waiting for bot/copilot review checks after ${MAX_WAIT_MINUTES}m" >&2
exit 1
