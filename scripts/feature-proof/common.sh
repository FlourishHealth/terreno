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
TOKEN_SECRET=local-token-secret
REFRESH_TOKEN_SECRET=local-refresh-secret
TOKEN_ISSUER=terreno-local
SESSION_SECRET=local-session-secret
TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
EOF
}

memory_mongo_uri_file() {
  echo "${ROOT_DIR}/.proof/memory-mongo.uri"
}

memory_mongo_pid_file() {
  echo "${ROOT_DIR}/.proof/memory-mongo.pid"
}

start_memory_mongo() {
  local uri_file
  local pid_file
  local mm_pid
  uri_file="$(memory_mongo_uri_file)"
  pid_file="$(memory_mongo_pid_file)"

  if [ -f "$pid_file" ]; then
    mm_pid="$(cat "$pid_file")"
    if kill -0 "$mm_pid" 2>/dev/null && [ -f "$uri_file" ]; then
      echo "Memory MongoDB already running (pid ${mm_pid})"
      export MONGO_URI="$(cat "$uri_file")"
      return 0
    fi
  fi

  rm -f "$uri_file"
  echo "Starting in-memory MongoDB (mongodb-memory-server)"
  (
    cd "${ROOT_DIR}/example-backend"
    export MEMORY_MONGO_URI_FILE="$uri_file"
    bun run memory-mongo
  ) &
  mm_pid="$!"
  echo "$mm_pid" > "$pid_file"
  append_pid_if_missing "$mm_pid" memory-mongo

  local i=1
  while [ ! -f "$uri_file" ] && [ "$i" -le 120 ]; do
    if ! kill -0 "$mm_pid" 2>/dev/null; then
      echo "::error::Memory MongoDB process exited before writing URI" >&2
      return 1
    fi
    sleep 1
    i=$((i + 1))
  done

  if [ ! -f "$uri_file" ]; then
    echo "::error::Memory MongoDB did not become ready within 120s" >&2
    return 1
  fi

  export MONGO_URI="$(cat "$uri_file")"
  echo "✓ Memory MongoDB ready (${MONGO_URI})"
}

ensure_mongo_for_stack() {
  start_memory_mongo
}

is_backend_running() {
  curl -sf "http://localhost:4000/health" | grep -q '"healthy":true'
}

is_frontend_running() {
  curl -sf "http://localhost:8082" >/dev/null 2>&1
}
