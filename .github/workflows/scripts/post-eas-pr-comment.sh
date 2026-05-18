#!/usr/bin/env bash
# Post (or update) the EAS PR build comment on a pull request.
#
# Required env:
#   GH_TOKEN          GitHub token with pull-requests: write
#   GITHUB_REPOSITORY owner/repo
#   PR_NUMBER         PR number to comment on
#   APP_NAME          "example-frontend" or "demo"
#   APP_DISPLAY       Pretty name for the comment header
#   APP_ICON          Emoji for the header (📱 or 🧪)
#   APP_SLUG          EAS project slug (e.g. terreno-example, terreno-demo)
#   IOS_HASH          iOS fingerprint hash
#   ANDROID_HASH      Android fingerprint hash
#   IOS_MATCH         "true" if a finished iOS dev build matches IOS_HASH
#   ANDROID_MATCH     "true" if a finished Android dev build matches ANDROID_HASH
#   PATH_TAKEN        "fast" or "slow"
#   WORKFLOW_RUN_URL  Optional URL to the EAS workflow run (links the comment)

set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${GITHUB_REPOSITORY:?missing}"
: "${PR_NUMBER:?missing}"
: "${APP_NAME:?missing}"
: "${APP_DISPLAY:?missing}"
: "${APP_ICON:?missing}"
: "${APP_SLUG:?missing}"
: "${IOS_HASH:?missing}"
: "${ANDROID_HASH:?missing}"
: "${IOS_MATCH:?missing}"
: "${ANDROID_MATCH:?missing}"
: "${PATH_TAKEN:?missing}"

MARKER="<!-- eas-pr-comment:${APP_NAME} -->"

ios_status="⚠️ Native deps changed — a new dev build was dispatched automatically"
if [ "$IOS_MATCH" = "true" ]; then
  ios_status="✅ Existing dev build can load this update"
fi

android_status="⚠️ Native deps changed — a new dev build was dispatched automatically"
if [ "$ANDROID_MATCH" = "true" ]; then
  android_status="✅ Existing dev build can load this update"
fi

if [ "$PATH_TAKEN" = "slow" ]; then
  path_note="🔨 **Slow path** — fingerprint changed, a fresh dev build is being produced on EAS (~15 min). The EAS Update was still published; existing dev builds with the prior fingerprint can keep using it. New per-job status checks will appear on this PR when the build finishes."
else
  path_note="✅ **Fast path** — fingerprint matched an existing dev build; published the EAS Update and confirmed it in real time."
fi

workflow_link=""
if [ -n "${WORKFLOW_RUN_URL:-}" ]; then
  workflow_link="

[View EAS workflow run]($WORKFLOW_RUN_URL)"
fi

body=$(cat <<EOF
$MARKER
### $APP_ICON $APP_DISPLAY — EAS PR build

**EAS Update branch:** \`pr-$PR_NUMBER\`

$path_note

**Fingerprint**
- iOS: \`$IOS_HASH\`
- Android: \`$ANDROID_HASH\`

**Dev build status (matching fingerprint)**
- iOS: $ios_status
- Android: $android_status

**How to test on your phone**
1. Install the latest \`$APP_SLUG\` dev build from the [EAS dashboard](https://expo.dev/accounts/flourishhealth/projects/$APP_SLUG/builds).
2. Open the dev build → shake → "Extensions" → "Branch" → select \`pr-$PR_NUMBER\`.
3. Pull to refresh after pushing more commits.$workflow_link
EOF
)

existing_id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --paginate \
  --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" | head -n 1 || true)

if [ -n "$existing_id" ]; then
  echo "Updating existing comment $existing_id"
  gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$existing_id" \
    -f body="$body" >/dev/null
else
  echo "Creating new comment"
  gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
    -f body="$body" >/dev/null
fi
