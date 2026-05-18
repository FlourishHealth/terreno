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
#   APP_SCHEME        Deep-link URL scheme (from app.json — e.g. frontend, terreno)
#   PROJECT_ID        EAS project UUID
#   IOS_MATCH         "true" if a finished iOS dev build matches IOS_HASH
#   ANDROID_MATCH     "true" if a finished Android dev build matches ANDROID_HASH
#   PATH_TAKEN        "fast" or "slow"

set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${GITHUB_REPOSITORY:?missing}"
: "${PR_NUMBER:?missing}"
: "${APP_NAME:?missing}"
: "${APP_DISPLAY:?missing}"
: "${APP_ICON:?missing}"
: "${APP_SLUG:?missing}"
: "${APP_SCHEME:?missing}"
: "${PROJECT_ID:?missing}"
: "${IOS_MATCH:?missing}"
: "${ANDROID_MATCH:?missing}"
: "${PATH_TAKEN:?missing}"

MARKER="<!-- eas-pr-comment:${APP_NAME} -->"

urlencode() {
  jq -nr --arg v "$1" '$v | @uri'
}

branch="pr-$PR_NUMBER"
update_url="https://u.expo.dev/$PROJECT_ID?channel-name=$branch"
deep_link="$APP_SCHEME://expo-development-client/?url=$(urlencode "$update_url")"
qr_image="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=$(urlencode "$deep_link")"
branch_dashboard="https://expo.dev/accounts/flourishhealth/projects/$APP_SLUG/updates?branchName=$branch"

ios_status="⚠️ Fingerprint changed — rebuilding"
[ "$IOS_MATCH" = "true" ] && ios_status="✅ Existing build matches"
android_status="⚠️ Fingerprint changed — rebuilding"
[ "$ANDROID_MATCH" = "true" ] && android_status="✅ Existing build matches"

path_line="✅ Fast path (waited on EAS)"
[ "$PATH_TAKEN" = "slow" ] && path_line="🔨 Slow path (dev build dispatched async)"

body=$(cat <<EOF
$MARKER
### $APP_ICON $APP_DISPLAY — EAS PR build

**EAS Update branch:** \`$branch\`

<details>
<summary>Launch on device</summary>

[![Scan with phone camera]($qr_image)]($deep_link)

[Open branch on EAS dashboard]($branch_dashboard)

**Status**
- Path: $path_line
- iOS dev build: $ios_status
- Android dev build: $android_status

**Instructions**
1. Install the latest \`$APP_SLUG\` dev build from the [EAS dashboard](https://expo.dev/accounts/flourishhealth/projects/$APP_SLUG/builds) (one-time, per phone).
2. Scan the QR above with your phone's camera — it opens the dev client straight onto this PR's branch. Or in the dev client, tap "Extensions" → "Branch" → \`$branch\`.
3. Pull to refresh after pushing more commits.

</details>
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
