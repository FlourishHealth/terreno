#!/usr/bin/env bash
# Capture feature proof with Appium + WebdriverIO (Chrome web or iOS simulator).
#
# Usage:
#   ./scripts/feature-proof/capture-native.sh [flow-name]
#   APPIUM_PLATFORM=ios ./scripts/feature-proof/capture-native.sh login
#
# Examples:
#   ./scripts/feature-proof/capture-native.sh login
#   ./scripts/feature-proof/capture-native.sh create-todo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

FLOW="${1:-login}"
PR_NUMBER="$(current_pr_number)"
PROOF_DIR="$(ensure_proof_dir "$PR_NUMBER")/appium-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROOF_DIR"

PLATFORM="${APPIUM_PLATFORM:-web}"

if ! command -v appium >/dev/null 2>&1 && ! bunx appium --version >/dev/null 2>&1; then
  echo "::error::Appium is not installed. Run: bun install && bun run appium:setup" >&2
  exit 1
fi

SPEC_FILE="${ROOT_DIR}/appium/specs/${FLOW}.spec.ts"
if [ ! -f "$SPEC_FILE" ]; then
  echo "::error::Appium spec not found: ${SPEC_FILE}" >&2
  exit 1
fi

if [ "$PLATFORM" = "web" ]; then
  "${SCRIPT_DIR}/start-stack.sh" --seed
  export MONGO_URI="$(cat "$(memory_mongo_uri_file)")"
else
  echo "APPIUM_PLATFORM=ios — ensure dev client is running (bun run proof:sim)"
fi

export PROOF_OUTPUT_DIR="$PROOF_DIR"
export APPIUM_PLATFORM="$PLATFORM"
export APPIUM_HOME="${APPIUM_HOME:-${HOME}/.appium-terreno}"

echo "Running Appium spec ${FLOW} (${PLATFORM}) — output in ${PROOF_DIR}"
cd "${ROOT_DIR}"
bunx wdio run appium/wdio.proof.conf.ts --spec "appium/specs/${FLOW}.spec.ts"

echo "${PROOF_DIR}" > "${ROOT_DIR}/.proof/latest-appium.txt"
echo "Appium proof artifacts: ${PROOF_DIR}"
