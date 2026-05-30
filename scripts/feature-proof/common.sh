#!/usr/bin/env bash
# Shared helpers for local feature verification and proof capture.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

proof_dir_for_pr() {
  local pr_number="${1:-local}"
  echo "${ROOT_DIR}/.proof/pr-${pr_number}"
}

current_pr_number() {
  if gh pr view --json number -q .number 2>/dev/null; then
    return 0
  fi
  echo "local"
}

ensure_proof_dir() {
  local pr_number="${1:-$(current_pr_number)}"
  local dir
  dir="$(proof_dir_for_pr "$pr_number")"
  mkdir -p "$dir"
  echo "$dir"
}

wait_for_url() {
  local url="$1"
  local label="${2:-service}"
  local attempts="${3:-30}"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "✓ ${label} ready (${url})"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "::error::${label} did not become ready at ${url}" >&2
  return 1
}

backend_env() {
  cat <<'EOF'
PORT=4000
MONGO_URI=mongodb://127.0.0.1/terreno-local
TOKEN_SECRET=local-token-secret
REFRESH_TOKEN_SECRET=local-refresh-secret
TOKEN_ISSUER=terreno-local
SESSION_SECRET=local-session-secret
TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
EOF
}

is_backend_running() {
  curl -sf "http://localhost:4000/health" | grep -q '"healthy":true'
}

is_frontend_running() {
  curl -sf "http://localhost:8082" >/dev/null 2>&1
}
