#!/usr/bin/env bash

set -uo pipefail

hook_host="${1:-}"
hook_input="$(cat)"
repository_root="$(git rev-parse --show-toplevel)"
cd "$repository_root"

if [[ "$hook_host" != "cursor" ]] && grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' <<<"$hook_input"; then
  printf '{}\n'
  exit 0
fi

lint_status=0
typecheck_status=0

bun run lint >&2 || lint_status=$?
bun run compile >&2 || typecheck_status=$?

if ((lint_status == 0 && typecheck_status == 0)); then
  printf '{}\n'
  exit 0
fi

echo "Quality checks failed: lint=$lint_status typecheck=$typecheck_status" >&2
if [[ "$hook_host" == "cursor" ]]; then
  printf '{"followup_message":"Lint or typecheck failed (lint=%d, typecheck=%d). Fix the reported errors before stopping."}\n' \
    "$lint_status" "$typecheck_status"
  exit 0
fi

printf '{"decision":"block","reason":"Lint or typecheck failed (lint=%d, typecheck=%d). Fix the reported errors before stopping."}\n' \
  "$lint_status" "$typecheck_status"
