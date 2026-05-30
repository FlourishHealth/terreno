#!/usr/bin/env bash
# Capture native feature proof with Maestro (screenshots on failure + debug output).
#
# Usage:
#   ./scripts/feature-proof/capture-native.sh [flow-name]
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
PROOF_DIR="$(ensure_proof_dir "$PR_NUMBER")/native-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROOF_DIR"

if ! command -v maestro >/dev/null 2>&1; then
  echo "::error::Maestro is not installed. Run: curl -fsSL https://get.maestro.mobile.dev | bash" >&2
  exit 1
fi

"${SCRIPT_DIR}/start-stack.sh" --seed

FLOW_FILE="${ROOT_DIR}/.maestro/flows/${FLOW}.yaml"
if [ ! -f "$FLOW_FILE" ]; then
  echo "::error::Flow not found: ${FLOW_FILE}" >&2
  exit 1
fi

echo "Running Maestro flow ${FLOW} — output in ${PROOF_DIR}"
MAESTRO_DRIVER_STARTUP_TIMEOUT=120000 \
  maestro test "$FLOW_FILE" \
  --debug-output "$PROOF_DIR"

echo "${PROOF_DIR}" > "${ROOT_DIR}/.proof/latest-native.txt"
echo "Maestro debug output: ${PROOF_DIR}"
