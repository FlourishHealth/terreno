#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
case "$target" in
  example-frontend) targets="example-frontend" ;;
  demo) targets="demo" ;;
  both) targets="example-frontend demo" ;;
  *)
    echo "Target must be example-frontend, demo, or both" >&2
    exit 2
    ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
scripts/ci/validate-env.sh EXPO_TOKEN

for app in $targets; do
  case "$app" in
    example-frontend) workflow_file="example-frontend-build.yml" ;;
    demo) workflow_file="demo-build.yml" ;;
  esac
  (
    cd "$app"
    bunx --bun eas-cli@latest workflow:run ".eas/workflows/${workflow_file}" --non-interactive
  )
done
