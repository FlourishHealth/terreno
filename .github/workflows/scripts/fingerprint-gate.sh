#!/usr/bin/env bash
# Fingerprint gate: compares PR fingerprint to master's and decides whether
# the gate passes. Manages the sticky PR comment, the per-fingerprint hidden
# acknowledgement marker, and auto-removes a stale ACK_LABEL when the PR's
# fingerprint changes after acknowledgement.
#
# Exits 0 when the gate passes (fingerprints match OR change is acknowledged
# for the current fingerprint). Exits 1 to fail the GitHub Actions check when
# a reviewer must acknowledge.
#
# Required env:
#   GH_TOKEN           GitHub token with pull-requests + issues write
#   GITHUB_REPOSITORY  owner/repo
#   PR_NUMBER          PR number
#   PR_IOS             PR iOS fingerprint hash
#   PR_ANDROID         PR Android fingerprint hash
#   MASTER_IOS         master iOS fingerprint hash
#   MASTER_ANDROID     master Android fingerprint hash
#   ACK_LABEL          Label name reviewers add to acknowledge
#   COMMENT_MARKER     Hidden HTML marker identifying our sticky comment

set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${GITHUB_REPOSITORY:?missing}"
: "${PR_NUMBER:?missing}"
: "${PR_IOS:?missing}"
: "${PR_ANDROID:?missing}"
: "${MASTER_IOS:?missing}"
: "${MASTER_ANDROID:?missing}"
: "${ACK_LABEL:?missing}"
: "${COMMENT_MARKER:?missing}"

# Filter by author so a PR author can't seed a comment with a forged ack
# marker that the gate then trusts. Anyone with write access can still edit
# the bot's own comment body, but at that point they could self-add the
# label too — same threat model.
find_sticky_comment_id() {
  gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --paginate \
    --jq "map(select(.user.login == \"github-actions[bot]\" and (.body | contains(\"$COMMENT_MARKER\")))) | first | .id // empty"
}

read_existing_ack_marker() {
  local comment_id="$1"
  [ -z "$comment_id" ] && return 0
  gh api "repos/$GITHUB_REPOSITORY/issues/comments/$comment_id" \
    --jq '.body' \
    | grep -oE 'fingerprint-gate-ack: ios=[a-f0-9]+ android=[a-f0-9]+' \
    || true
}

upsert_comment() {
  local body="$1"
  local existing
  existing=$(find_sticky_comment_id)
  if [ -n "$existing" ]; then
    gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$existing" \
      -f body="$body" >/dev/null
  else
    gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
      -f body="$body" >/dev/null
  fi
}

delete_sticky_comment() {
  local existing
  existing=$(find_sticky_comment_id)
  if [ -n "$existing" ]; then
    gh api --method DELETE \
      "repos/$GITHUB_REPOSITORY/issues/comments/$existing" >/dev/null
  fi
}

ensure_label_exists() {
  if ! gh api "repos/$GITHUB_REPOSITORY/labels/$ACK_LABEL" >/dev/null 2>&1; then
    gh api --method POST "repos/$GITHUB_REPOSITORY/labels" \
      -f name="$ACK_LABEL" \
      -f color="b60205" \
      -f description="Reviewer has acknowledged a native fingerprint change in this PR." \
      >/dev/null 2>&1 || true
  fi
}

has_ack_label() {
  gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/labels" \
    --jq "map(.name) | index(\"$ACK_LABEL\")" \
    | grep -q '^[0-9]\+$'
}

remove_ack_label() {
  gh api --method DELETE \
    "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/labels/$ACK_LABEL" \
    >/dev/null 2>&1 || true
}

short() {
  echo "${1:0:12}"
}

ensure_label_exists

ios_short=$(short "$PR_IOS")
android_short=$(short "$PR_ANDROID")
master_ios_short=$(short "$MASTER_IOS")
master_android_short=$(short "$MASTER_ANDROID")

# === Case 1: fingerprints match master ===
if [ "$PR_IOS" = "$MASTER_IOS" ] && [ "$PR_ANDROID" = "$MASTER_ANDROID" ]; then
  echo "::notice::Fingerprint unchanged vs master — no native build needed."
  delete_sticky_comment
  exit 0
fi

# === Fingerprints differ — evaluate acknowledgement ===
current_ack="fingerprint-gate-ack: ios=$PR_IOS android=$PR_ANDROID"
existing_id=$(find_sticky_comment_id)
existing_ack=""
[ -n "$existing_id" ] && existing_ack=$(read_existing_ack_marker "$existing_id")
label_present=false
has_ack_label && label_present=true

# === Case 2: acknowledged for the current fingerprint state ===
# Empty existing_ack also counts as "acknowledged at current fingerprint":
# the reviewer added the label before any bot comment existed (e.g. they
# labeled while the initial run was canceled by cancel-in-progress, or
# someone manually deleted the bot's comment). Treat label-add as a
# definitive ack at the current state and let Case 3 catch later drift.
if $label_present && { [ -z "$existing_ack" ] || [ "$existing_ack" = "$current_ack" ]; }; then
  body=$(cat <<EOF
$COMMENT_MARKER
<!-- $current_ack -->

### ✅ Native build change acknowledged — example-frontend

A new EAS dev build will be produced for this PR. A reviewer has acknowledged that the change is intentional.

| platform | master fingerprint | PR fingerprint |
| --- | --- | --- |
| iOS | \`$master_ios_short…\` | \`$ios_short…\` |
| Android | \`$master_android_short…\` | \`$android_short…\` |

Acknowledged via the \`$ACK_LABEL\` label. Removing the label, or pushing a commit that changes the fingerprint again, will re-block this PR.
EOF
)
  upsert_comment "$body"
  echo "::notice::Fingerprint change acknowledged via $ACK_LABEL label."
  exit 0
fi

# === Case 3: label present but PR fingerprint changed since acknowledgement ===
if $label_present && [ -n "$existing_ack" ] && [ "$existing_ack" != "$current_ack" ]; then
  remove_ack_label
  body=$(cat <<EOF
$COMMENT_MARKER
<!-- $current_ack -->

### 🚨 Fingerprint changed AFTER acknowledgement — example-frontend

**REQUIRES REVIEWER RE-ACKNOWLEDGEMENT**

This PR was already acknowledged for a different fingerprint, but a new commit changed the native fingerprint again. The \`$ACK_LABEL\` label has been **automatically removed**.

| platform | master fingerprint | PR fingerprint |
| --- | --- | --- |
| iOS | \`$master_ios_short…\` | \`$ios_short…\` |
| Android | \`$master_android_short…\` | \`$android_short…\` |

Re-review the native change and re-add the \`$ACK_LABEL\` label.
EOF
)
  upsert_comment "$body"
  echo "::error::Fingerprint changed after acknowledgement — re-acknowledgement required."
  exit 1
fi

# === Case 4: change detected, no acknowledgement yet ===
body=$(cat <<EOF
$COMMENT_MARKER
<!-- $current_ack -->

### 🚨 Native build change detected — example-frontend

**REQUIRES REVIEWER ACKNOWLEDGEMENT BEFORE MERGE**

This PR changes the Expo native fingerprint of \`example-frontend\` vs \`master\`. Merging it will force a new EAS dev build, and every developer with a local checkout will need to install the new dev build before they can run the app.

| platform | master fingerprint | PR fingerprint |
| --- | --- | --- |
| iOS | \`$master_ios_short…\` | \`$ios_short…\` |
| Android | \`$master_android_short…\` | \`$android_short…\` |

#### What a reviewer should do

1. Confirm the native change is intentional (new dep with native code, plugin config, app.json / eas.json edit, Expo SDK bump, etc.).
2. If it's intentional and accepted, add the **\`$ACK_LABEL\`** label to this PR.
3. The \`Fingerprint gate / example-frontend\` check will turn green and the PR can be merged.

> If you did not expect to change the native fingerprint, look for: a new dep with native code, an Expo config plugin change, an app.json / eas.json edit, or a bumped Expo SDK.
EOF
)
upsert_comment "$body"
echo "::error::Native fingerprint changed vs master. Add the '$ACK_LABEL' label after reviewing."
exit 1
