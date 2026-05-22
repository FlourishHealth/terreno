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
#   IOS_DEVICE_BUILD_ID Latest finished iOS device dev build ID (may be empty)
#   IOS_SIM_BUILD_ID    Latest finished iOS simulator dev build ID (may be empty)
#   ANDROID_BUILD_ID    Latest finished Android dev build ID (may be empty)

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

install_link() {
  local label="$1" build_id="$2"
  if [ -n "$build_id" ]; then
    echo "- [$label]($builds_root/$build_id)"
  else
    echo "- $label: no build yet — trigger via [Trigger EAS Workflow](https://github.com/$GITHUB_REPOSITORY/actions/workflows/eas-dev-build.yml)"
  fi
}

builds_root="https://expo.dev/accounts/flourishhealth/projects/$APP_SLUG/builds"
install_section=$(
  install_link "Install iOS device dev build" "${IOS_DEVICE_BUILD_ID:-}"
  install_link "Install iOS simulator dev build" "${IOS_SIM_BUILD_ID:-}"
  install_link "Install Android dev build" "${ANDROID_BUILD_ID:-}"
)

body=$(cat <<EOF
$MARKER
### $APP_ICON $APP_DISPLAY — EAS PR build

**EAS Update branch:** \`$branch\`

<details>
<summary>Launch on device</summary>

[![Scan with phone camera]($qr_image)]($deep_link)

[Open branch on EAS dashboard]($branch_dashboard)

**Install latest dev build**
$install_section

**Status**
- Path: $path_line
- iOS dev build matches fingerprint: $ios_status
- Android dev build matches fingerprint: $android_status

**Instructions**
1. Install the right dev build above (one-time, per phone/simulator).
2. Scan the QR with your phone's camera — it opens the dev client straight onto this PR's branch. Or in the dev client, tap "Extensions" → "Branch" → \`$branch\`.
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
