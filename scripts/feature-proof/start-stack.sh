#!/usr/bin/env bash
# Start example-backend + example-frontend (web) for local feature verification.
#
# Usage:
#   ./scripts/feature-proof/start-stack.sh [--seed] [--no-frontend] [--no-backend]
#   STOP_STACK=1 ./scripts/feature-proof/start-stack.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

PID_FILE="${ROOT_DIR}/.proof/stack.pids"
mkdir -p "${ROOT_DIR}/.proof"

stop_stack() {
  if [ -f "$PID_FILE" ]; then
    while read -r pid name; do
      if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping ${name} (pid ${pid})"
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
}

if [ "${STOP_STACK:-}" = "1" ]; then
  stop_stack
  exit 0
fi

SEED=false
START_BACKEND=true
START_FRONTEND=true

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    --no-frontend) START_FRONTEND=false ;;
    --no-backend) START_BACKEND=false ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

append_pid_if_missing() {
  local pid="$1"
  local name="$2"
  if [ -f "$PID_FILE" ] && grep -q "^${pid} ${name}$" "$PID_FILE" 2>/dev/null; then
    return 0
  fi
  echo "$pid $name" >> "$PID_FILE"
}

record_running_pid() {
  local port="$1"
  local name="$2"
  local pid
  pid=$(lsof -ti ":${port}" 2>/dev/null | head -1 || true)
  if [ -n "$pid" ]; then
    append_pid_if_missing "$pid" "$name"
  fi
}

if [ "$START_BACKEND" = true ]; then
  if is_backend_running; then
    echo "Backend already running on :4000"
    record_running_pid 4000 backend
  else
    echo "Starting example-backend on :4000"
    (
      cd "${ROOT_DIR}/example-backend"
      export $(backend_env | xargs)
      bun run dev
    ) &
    append_pid_if_missing "$!" backend
    wait_for_url "http://localhost:4000/health" "backend"
  fi

  if [ "$SEED" = true ]; then
    echo "Seeding test data"
    (
      cd "${ROOT_DIR}/example-backend"
      export $(backend_env | xargs)
      bun run seed
    )
  fi
fi

if [ "$START_FRONTEND" = true ]; then
  if is_frontend_running; then
    echo "Frontend already running on :8082"
    record_running_pid 8082 frontend
  else
    echo "Starting example-frontend web on :8082"
    (
      cd "${ROOT_DIR}/example-frontend"
      export EXPO_PUBLIC_API_URL=http://localhost:4000
      bun run web
    ) &
    append_pid_if_missing "$!" frontend
    wait_for_url "http://localhost:8082" "frontend"
  fi
fi

echo ""
echo "Stack ready:"
echo "  Backend:  http://localhost:4000"
echo "  Frontend: http://localhost:8082"
echo "  Stop:     bun run stack:stop"
