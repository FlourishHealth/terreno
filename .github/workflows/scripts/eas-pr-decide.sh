#!/usr/bin/env bash
# Decide whether the EAS PR flow should queue native dev builds.
#
# Native builds are only queued when a fingerprint is *new* — meaning no
# finished build exists for that hash yet. Once a fingerprint is known,
# JS-only PRs take the update-only fast path instead of re-queueing the
# platforms that never got an artifact; seed those via the manual
# "Trigger EAS Workflow" job rather than from every PR.
#
# "Known" is evaluated per fingerprint hash, not across all platforms:
# iOS and Android hashes are independent, so an unchanged Android build
# must never suppress builds for a changed iOS runtime. Either iOS profile
# (device or simulator) having a finished build marks the iOS hash known.
#
# For a new hash, builds already queued or running for it count as covered
# so repeated pushes on the same PR do not stack duplicate builds.
#
# Writes GitHub Actions outputs to $GITHUB_OUTPUT (required):
#   ios_hash / android_hash          computed fingerprints
#   *_finished                       a finished build matches the hash
#   *_match                          covered (finished, queued, or running)
#   *_active                         a queued or running build matches the hash
#   *_latest                         newest finished build id, for install links
#   needs_build                      "true" when any platform must be built
#
# Optional env:
#   IOS_DEVICE_PROFILE   default: development
#   IOS_SIM_PROFILE      default: development:simulator
#   ANDROID_PROFILE      default: development

set -euo pipefail

: "${GITHUB_OUTPUT:?missing GITHUB_OUTPUT}"

IOS_DEVICE_PROFILE="${IOS_DEVICE_PROFILE:-development}"
IOS_SIM_PROFILE="${IOS_SIM_PROFILE:-development:simulator}"
ANDROID_PROFILE="${ANDROID_PROFILE:-development}"

# EAS statuses that mean a build for this fingerprint already exists or is
# on its way. `new` and `in-queue` both precede `in-progress`, so all three
# must count or a synchronize event mid-queue re-dispatches the same build.
ACTIVE_STATUSES=(new in-queue in-progress)

# count_builds <platform> <profile> <hash> [status]
count_builds() {
  local platform="$1"
  local profile="$2"
  local hash="$3"
  local status="${4:-}"
  local args=(
    build:list
    --platform "$platform"
    --profile "$profile"
    --fingerprint-hash "$hash"
    --limit 1
    --non-interactive
    --json
  )
  if [ -n "$status" ]; then
    args+=(--status "$status")
  fi
  eas "${args[@]}" | jq 'length'
}

# has_active <platform> <profile> <hash> — true when a build is queued or running.
has_active() {
  local platform="$1"
  local profile="$2"
  local hash="$3"
  local status count
  for status in "${ACTIVE_STATUSES[@]}"; do
    count=$(count_builds "$platform" "$profile" "$hash" "$status")
    if [ "$count" -gt 0 ]; then
      return 0
    fi
  done
  return 1
}

# latest_finished <platform> <profile> — newest finished build id for install links.
latest_finished() {
  eas build:list --platform "$1" --profile "$2" --status finished --limit 1 --non-interactive --json |
    jq -r '.[0].id // empty'
}

bool() {
  [ "$1" -gt 0 ] && echo true || echo false
}

ios_hash=$(eas fingerprint:generate --platform ios --non-interactive --json | jq -r '.hash')
android_hash=$(eas fingerprint:generate --platform android --non-interactive --json | jq -r '.hash')

ios_device_finished_count=$(count_builds ios "$IOS_DEVICE_PROFILE" "$ios_hash" finished)
ios_sim_finished_count=$(count_builds ios "$IOS_SIM_PROFILE" "$ios_hash" finished)
android_finished_count=$(count_builds android "$ANDROID_PROFILE" "$android_hash" finished)

ios_device_finished=$(bool "$ios_device_finished_count")
ios_sim_finished=$(bool "$ios_sim_finished_count")
android_finished=$(bool "$android_finished_count")

ios_device_latest=$(latest_finished ios "$IOS_DEVICE_PROFILE")
ios_sim_latest=$(latest_finished ios "$IOS_SIM_PROFILE")
android_latest=$(latest_finished android "$ANDROID_PROFILE")

echo "iOS fingerprint:     $ios_hash  finished device: $ios_device_finished_count  finished sim: $ios_sim_finished_count  latest device: $ios_device_latest  latest sim: $ios_sim_latest"
echo "Android fingerprint: $android_hash  finished: $android_finished_count  latest: $android_latest"

# Per-hash "known" checks — iOS and Android fingerprints move independently.
ios_hash_known=false
android_hash_known=false
[ "$((ios_device_finished_count + ios_sim_finished_count))" -gt 0 ] && ios_hash_known=true
[ "$android_finished_count" -gt 0 ] && android_hash_known=true

# A platform is covered when it must not be queued: either its hash is
# already known, or it has a finished/queued/running build of its own.
ios_device_match=true
ios_sim_match=true
android_match=true
ios_device_active=false
ios_sim_active=false
android_active=false

if [ "$ios_hash_known" = "true" ]; then
  echo "::notice::iOS fingerprint $ios_hash already has a finished dev build — update-only (missing iOS platforms are not re-seeded every PR)."
else
  echo "::notice::iOS fingerprint $ios_hash is new — queue iOS builds that are not already running."
  if has_active ios "$IOS_DEVICE_PROFILE" "$ios_hash"; then
    ios_device_active=true
  else
    ios_device_match=false
  fi
  if has_active ios "$IOS_SIM_PROFILE" "$ios_hash"; then
    ios_sim_active=true
  else
    ios_sim_match=false
  fi
fi

if [ "$android_hash_known" = "true" ]; then
  echo "::notice::Android fingerprint $android_hash already has a finished dev build — update-only."
else
  echo "::notice::Android fingerprint $android_hash is new — queue an Android build if one is not already running."
  if has_active android "$ANDROID_PROFILE" "$android_hash"; then
    android_active=true
  else
    android_match=false
  fi
fi

needs_build=false
if [ "$ios_device_match" = "false" ] || [ "$ios_sim_match" = "false" ] || [ "$android_match" = "false" ]; then
  needs_build=true
fi

{
  echo "ios_hash=$ios_hash"
  echo "android_hash=$android_hash"
  echo "ios_device_finished=$ios_device_finished"
  echo "ios_sim_finished=$ios_sim_finished"
  echo "android_finished=$android_finished"
  echo "ios_device_match=$ios_device_match"
  echo "ios_sim_match=$ios_sim_match"
  echo "android_match=$android_match"
  echo "ios_device_active=$ios_device_active"
  echo "ios_sim_active=$ios_sim_active"
  echo "android_active=$android_active"
  echo "ios_device_latest=$ios_device_latest"
  echo "ios_sim_latest=$ios_sim_latest"
  echo "android_latest=$android_latest"
  echo "needs_build=$needs_build"
} >> "$GITHUB_OUTPUT"
