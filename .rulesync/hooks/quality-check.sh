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
analysis_status=0

bun run lint >&2 || lint_status=$?
bun run compile >&2 || typecheck_status=$?
bun run analyze:full >&2 || analysis_status=$?

if ((lint_status == 0 && typecheck_status == 0 && analysis_status == 0)); then
  printf '{}\n'
  exit 0
fi

echo "Quality checks failed: lint=$lint_status typecheck=$typecheck_status analysis=$analysis_status" >&2
if [[ "$hook_host" == "cursor" ]]; then
  printf '{"followup_message":"Quality checks failed (lint=%d, typecheck=%d, analysis=%d). Fix the reported errors before stopping."}\n' \
    "$lint_status" "$typecheck_status" "$analysis_status"
  exit 0
fi

printf '{"decision":"block","reason":"Quality checks failed (lint=%d, typecheck=%d, analysis=%d). Fix the reported errors before stopping."}\n' \
  "$lint_status" "$typecheck_status" "$analysis_status"
