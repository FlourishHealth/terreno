#!/usr/bin/env bash
# Install Appium drivers used by feature-proof and CI workflows.
#
# Usage: ./scripts/feature-proof/setup-appium.sh

set -euo pipefail

# Install drivers outside the Bun workspace so Appium's npm install does not
# hit catalog: protocol URLs in the repo root package.json.
export APPIUM_HOME="${APPIUM_HOME:-${HOME}/.appium-terreno}"
mkdir -p "$APPIUM_HOME"

if command -v appium >/dev/null 2>&1; then
  APPIUM=(appium)
else
  echo "Appium CLI not on PATH — using bunx appium"
  APPIUM=(bunx appium)
fi

echo "Installing Appium Chromium driver (web / Chrome) to ${APPIUM_HOME}..."
"${APPIUM[@]}" driver install chromium

if [ "$(uname -s)" = "Darwin" ]; then
  echo "Installing Appium XCUITest driver (iOS simulator)..."
  "${APPIUM[@]}" driver install xcuitest
fi

echo "Appium drivers ready (APPIUM_HOME=${APPIUM_HOME})."
