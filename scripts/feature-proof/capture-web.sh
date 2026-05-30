#!/usr/bin/env bash
# Capture web feature proof with Playwright (screenshots + video + HTML report).
#
# Usage:
#   ./scripts/feature-proof/capture-web.sh [spec-or-flow]
#
# Examples:
#   ./scripts/feature-proof/capture-web.sh login
#   ./scripts/feature-proof/capture-web.sh e2e/todos.spec.ts
#   ./scripts/feature-proof/capture-web.sh   # runs full e2e suite

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

TARGET="${1:-}"
PR_NUMBER="$(current_pr_number)"
PROOF_DIR="$(ensure_proof_dir "$PR_NUMBER")/web-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROOF_DIR"

"${SCRIPT_DIR}/start-stack.sh" --seed

cd "${ROOT_DIR}/example-frontend"

export PROOF_OUTPUT_DIR="$PROOF_DIR"
export CI=""

PLAYWRIGHT_ARGS=()
if [ -n "$TARGET" ]; then
  if [ -f "$TARGET" ]; then
    PLAYWRIGHT_ARGS+=("$TARGET")
  elif [ -f "e2e/${TARGET}.spec.ts" ]; then
    PLAYWRIGHT_ARGS+=("e2e/${TARGET}.spec.ts")
  else
    PLAYWRIGHT_ARGS+=("$TARGET")
  fi
fi

echo "Recording proof to ${PROOF_DIR}"
bunx playwright test --config playwright.proof.config.ts "${PLAYWRIGHT_ARGS[@]}"

REPORT_PATH="${PROOF_DIR}/report/index.html"
if [ -f "$REPORT_PATH" ]; then
  echo ""
  echo "Proof report: file://${PROOF_DIR}/report/index.html"
  echo "Open: xdg-open '${PROOF_DIR}/report/index.html' 2>/dev/null || open '${PROOF_DIR}/report/index.html'"
fi

echo "${PROOF_DIR}" > "${ROOT_DIR}/.proof/latest-web.txt"
echo "Latest proof path saved to .proof/latest-web.txt"
