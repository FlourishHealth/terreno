#!/usr/bin/env bash
# Attach local feature proof summary to the current PR (comment + body section).
#
# Usage:
#   ./scripts/feature-proof/attach-pr-proof.sh [--dir path] [--summary "text"]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

PROOF_DIR=""
SUMMARY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)
      PROOF_DIR="$2"
      shift 2
      ;;
    --summary)
      SUMMARY="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

PR_NUMBER="$(gh pr view --json number -q .number 2>/dev/null || true)"
if [ -z "$PR_NUMBER" ]; then
  echo "::error::No open PR for current branch" >&2
  exit 1
fi

if [ -z "$PROOF_DIR" ]; then
  if [ -f "${ROOT_DIR}/.proof/latest-web.txt" ]; then
    PROOF_DIR="$(cat "${ROOT_DIR}/.proof/latest-web.txt")"
  elif [ -f "${ROOT_DIR}/.proof/latest-native.txt" ]; then
    PROOF_DIR="$(cat "${ROOT_DIR}/.proof/latest-native.txt")"
  else
    PROOF_DIR="$(ensure_proof_dir "$PR_NUMBER")"
  fi
fi

MARKER="<!-- feature-proof -->"
TIMESTAMP="$(date -u +"%Y-%m-%d %H:%M UTC")"

screenshots=$(find "$PROOF_DIR" -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.webm' -o -name '*.mp4' \) 2>/dev/null | head -20 || true)
report_file=""
if [ -f "${PROOF_DIR}/report/index.html" ]; then
  report_file="${PROOF_DIR}/report/index.html"
fi

artifact_list=""
if [ -n "$screenshots" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    artifact_list="${artifact_list}"$'\n'"- \`${file}\`"
  done <<< "$screenshots"
fi

body=$(cat <<EOF
${MARKER}
### Feature proof (${TIMESTAMP})

${SUMMARY:-"Verified locally with captured screenshots/video."}

**Artifacts**
${artifact_list:-"(no screenshots/video found — re-run \`bun run proof:web\` or \`bun run proof:native\`)"}
$([ -n "$report_file" ] && echo "- Playwright HTML report: \`${report_file}\`")

_Agent: attach key screenshots to this thread for reviewers. Paths above are on the dev machine._
EOF
)

existing_id=$(gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/issues/${PR_NUMBER}/comments" --paginate \
  --jq ".[] | select(.body | contains(\"${MARKER}\")) | .id" | head -n 1 || true)

if [ -n "$existing_id" ]; then
  gh api --method PATCH "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/issues/comments/${existing_id}" \
    -f body="$body" >/dev/null
  echo "Updated feature proof comment on PR #${PR_NUMBER}"
else
  gh pr comment "$PR_NUMBER" --body "$body"
  echo "Posted feature proof comment on PR #${PR_NUMBER}"
fi
