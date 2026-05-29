#!/usr/bin/env bash
# Launch iOS Simulator with the latest EAS dev-client build and PR update channel.
#
# Requires: macOS, Xcode simulators, EAS CLI (eas login), Expo dev client installed once.
#
# Usage:
#   ./scripts/feature-proof/launch-ios-sim.sh [example-frontend|demo] [pr-number]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

APP="${1:-example-frontend}"
PR_NUMBER="${2:-$(current_pr_number)}"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "iOS simulator launch requires macOS. Use capture-web.sh or capture-native.sh on Linux." >&2
  exit 1
fi

if ! command -v eas >/dev/null 2>&1; then
  echo "::error::EAS CLI not found. Install: npm i -g eas-cli && eas login" >&2
  exit 1
fi

APP_DIR="${ROOT_DIR}/${APP}"
if [ ! -d "$APP_DIR" ]; then
  echo "::error::Unknown app directory: ${APP_DIR}" >&2
  exit 1
fi

SIM_NAME="${SIMULATOR_DEVICE:-iPhone 16}"
echo "Booting simulator: ${SIM_NAME}"
xcrun simctl boot "$SIM_NAME" 2>/dev/null || true
open -a Simulator

cd "$APP_DIR"

BUILD_ID=$(eas build:list \
  --platform ios \
  --profile development:simulator \
  --status finished \
  --limit 1 \
  --non-interactive \
  --json | jq -r '.[0].id // empty')

if [ -n "$BUILD_ID" ]; then
  echo "Installing latest iOS simulator dev build: ${BUILD_ID}"
  eas build:run --id "$BUILD_ID" --platform ios --non-interactive
else
  echo "No finished simulator dev build found. Trigger one from CI or:"
  echo "  cd ${APP} && bun run eas:ios-sim"
fi

if [ "$PR_NUMBER" != "local" ] && [ "$PR_NUMBER" != "0" ]; then
  echo "Starting dev client on EAS Update branch pr-${PR_NUMBER}"
  EXPO_NO_DOTENV=1 \
    EXUpdatesChannel="pr-${PR_NUMBER}" \
    bun expo start --dev-client --ios --port "$([ "$APP" = demo ] && echo 8085 || echo 8082)"
else
  echo "Starting dev client (local Metro — no PR channel)"
  bun expo start --dev-client --ios --port "$([ "$APP" = demo ] && echo 8085 || echo 8082)"
fi
