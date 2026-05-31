#!/usr/bin/env bash
# Regenerate example-frontend openApiSdk.ts using in-memory MongoDB + example-backend.
#
# Usage:
#   ./scripts/feature-proof/generate-sdk.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

cleanup() {
  STOP_STACK=1 bash "${SCRIPT_DIR}/start-stack.sh" >/dev/null 2>&1 || true
}

trap cleanup EXIT

"${SCRIPT_DIR}/start-stack.sh" --no-frontend

wait_for_url "http://localhost:4000/openapi.json" "OpenAPI spec" 60

echo "Generating SDK from http://localhost:4000/openapi.json"
(
  cd "${ROOT_DIR}/example-frontend"
  bun run sdk
)

echo "SDK generation complete"
