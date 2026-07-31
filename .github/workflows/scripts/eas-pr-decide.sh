#!/usr/bin/env bash
# Decide whether the EAS PR flow should queue native dev builds.
#
# Native builds are only queued when the current fingerprint is *new* —
# meaning no finished build exists for this hash on any of the three
# profiles (iOS device, iOS simulator, Android). If the fingerprint is
# already known (any finished match), JS-only PRs take the update-only
# fast path even when a platform is missing coverage. Seed missing
# platforms via the manual "Trigger EAS Workflow" job, not every PR.
#
# When the fingerprint is new, we still treat in-progress / new builds as
# matches so repeated pushes on the same PR do not re-queue duplicates.
#
# Writes GitHub Actions outputs to $GITHUB_OUTPUT (required).
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

# Count builds for a platform/profile/fingerprint, optionally filtered by status.
# Usage: count_builds <platform> <profile> <hash> [status]
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

# True when finished, in-progress, or new builds exist for this fingerprint.
# Prevents re-queueing while a prior dispatch is still running.
has_active_or_finished() {
  local platform="$1"
  local profile="$2"
  local hash="$3"
  local finished in_progress new_builds
  finished=$(count_builds "$platform" "$profile" "$hash" finished)
  in_progress=$(count_builds "$platform" "$profile" "$hash" in-progress)
  new_builds=$(count_builds "$platform" "$profile" "$hash" new)
  [ "$((finished + in_progress + new_builds))" -gt 0 ]
}

ios_hash=$(eas fingerprint:generate --platform ios --non-interactive --json | jq -r '.hash')
android_hash=$(eas fingerprint:generate --platform android --non-interactive --json | jq -r '.hash')

ios_device_finished=$(count_builds ios "$IOS_DEVICE_PROFILE" "$ios_hash" finished)
ios_sim_finished=$(count_builds ios "$IOS_SIM_PROFILE" "$ios_hash" finished)
android_finished=$(count_builds android "$ANDROID_PROFILE" "$android_hash" finished)

# Latest finished build per (platform, profile) for the comment's install-page links.
ios_device_latest=$(eas build:list --platform ios --profile "$IOS_DEVICE_PROFILE" --status finished --limit 1 --non-interactive --json | jq -r '.[0].id // empty')
ios_sim_latest=$(eas build:list --platform ios --profile "$IOS_SIM_PROFILE" --status finished --limit 1 --non-interactive --json | jq -r '.[0].id // empty')
android_latest=$(eas build:list --platform android --profile "$ANDROID_PROFILE" --status finished --limit 1 --non-interactive --json | jq -r '.[0].id // empty')

echo "iOS fingerprint:     $ios_hash  finished device: $ios_device_finished  finished sim: $ios_sim_finished  latest device: $ios_device_latest  latest sim: $ios_sim_latest"
echo "Android fingerprint: $android_hash  finished: $android_finished  latest: $android_latest"

ios_device_match=false
ios_sim_match=false
android_match=false
[ "$ios_device_finished" -gt 0 ] && ios_device_match=true
[ "$ios_sim_finished" -gt 0 ] && ios_sim_match=true
[ "$android_finished" -gt 0 ] && android_match=true

finished_any=$((ios_device_finished + ios_sim_finished + android_finished))
needs_build=false

if [ "$finished_any" -gt 0 ]; then
  echo "::notice::Fingerprint already has at least one finished dev build — update-only (missing platforms are not re-seeded on every PR)."
  needs_build=false
else
  echo "::notice::Fingerprint is new (no finished matches) — queue native builds for platforms without an active/finished build."
  # For selective queueing, treat in-progress/new as matched so we don't duplicate.
  ios_device_match=false
  ios_sim_match=false
  android_match=false
  if has_active_or_finished ios "$IOS_DEVICE_PROFILE" "$ios_hash"; then
    ios_device_match=true
  fi
  if has_active_or_finished ios "$IOS_SIM_PROFILE" "$ios_hash"; then
    ios_sim_match=true
  fi
  if has_active_or_finished android "$ANDROID_PROFILE" "$android_hash"; then
    android_match=true
  fi
  if [ "$ios_device_match" = "true" ] && [ "$ios_sim_match" = "true" ] && [ "$android_match" = "true" ]; then
    needs_build=false
    echo "::notice::All platforms already have an active or finished build for this fingerprint."
  else
    needs_build=true
  fi
fi

{
  echo "ios_hash=$ios_hash"
  echo "android_hash=$android_hash"
  echo "ios_device_match=$ios_device_match"
  echo "ios_sim_match=$ios_sim_match"
  echo "android_match=$android_match"
  echo "ios_device_latest=$ios_device_latest"
  echo "ios_sim_latest=$ios_sim_latest"
  echo "android_latest=$android_latest"
  echo "needs_build=$needs_build"
} >> "$GITHUB_OUTPUT"
