#!/usr/bin/env bash
# Queue only the dev-client EAS builds whose fingerprint has no finished match.
# Used by eas-pr.yml slow path instead of dispatching a full 3-platform workflow.
#
# Required env:
#   IOS_DEVICE_MATCH  "true" when a finished iOS device dev build matches
#   IOS_SIM_MATCH     "true" when a finished iOS simulator dev build matches
#   ANDROID_MATCH     "true" when a finished Android dev build matches
#   IOS_DEVICE_PROFILE   EAS profile for iOS device (default: development)
#   IOS_SIM_PROFILE      EAS profile for iOS simulator (default: development:simulator)

set -euo pipefail

IOS_DEVICE_PROFILE="${IOS_DEVICE_PROFILE:-development}"
IOS_SIM_PROFILE="${IOS_SIM_PROFILE:-development:simulator}"
ANDROID_PROFILE="${ANDROID_PROFILE:-development}"

queued=0

if [ "${IOS_DEVICE_MATCH:-}" != "true" ]; then
  echo "::notice::Queueing iOS device dev build (profile: $IOS_DEVICE_PROFILE)"
  eas build --profile "$IOS_DEVICE_PROFILE" --platform ios --non-interactive --no-wait
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
