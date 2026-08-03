#!/usr/bin/env bash
# Queue only the dev-client EAS builds whose fingerprint has no finished match.
# Used by eas-pr.yml slow path instead of dispatching a full 3-platform workflow.
#
# iOS device builds use `eas workflow:run` so Apple signing credentials are
# resolved on EAS Cloud. `eas build` from GitHub Actions fails non-interactively
# with "Credentials are not set up" for com.terreno.todo device profiles.
#
# Required env (set from eas-pr-decide.sh outputs) — "true" means the platform
# is already covered for this fingerprint by a finished, queued, or running
# build, so nothing is dispatched for it:
#   IOS_DEVICE_MATCH  iOS device dev build is covered
#   IOS_SIM_MATCH     iOS simulator dev build is covered
#   ANDROID_MATCH     Android dev build is covered
#   IOS_SIM_PROFILE      EAS profile for iOS simulator (default: development:simulator)

set -euo pipefail

IOS_SIM_PROFILE="${IOS_SIM_PROFILE:-development:simulator}"
ANDROID_PROFILE="${ANDROID_PROFILE:-development}"
IOS_DEVICE_WORKFLOW="${IOS_DEVICE_WORKFLOW:-.eas/workflows/ios-device-build.yml}"

queued=0

if [ "${IOS_DEVICE_MATCH:-}" != "true" ]; then
  echo "::notice::Dispatching iOS device dev build workflow ($IOS_DEVICE_WORKFLOW)"
  eas workflow:run "$IOS_DEVICE_WORKFLOW" --non-interactive
  queued=$((queued + 1))
fi

if [ "${IOS_SIM_MATCH:-}" != "true" ]; then
  echo "::notice::Queueing iOS simulator dev build (profile: $IOS_SIM_PROFILE)"
  eas build --profile "$IOS_SIM_PROFILE" --platform ios --non-interactive --no-wait
  queued=$((queued + 1))
fi

if [ "${ANDROID_MATCH:-}" != "true" ]; then
  echo "::notice::Queueing Android dev build (profile: $ANDROID_PROFILE)"
  eas build --profile "$ANDROID_PROFILE" --platform android --non-interactive --no-wait
  queued=$((queued + 1))
fi

if [ "$queued" -eq 0 ]; then
  echo "::warning::Slow path invoked but all platforms already matched — nothing queued"
else
  echo "Queued $queued dev build(s) on EAS Cloud (--no-wait)."
fi
