#!/usr/bin/env bash

set -uo pipefail

repository_root="$(git rev-parse --show-toplevel)"
cd "$repository_root"

lint_status=0
typecheck_status=0

bun run lint || lint_status=$?
bun run compile || typecheck_status=$?

if ((lint_status == 0 && typecheck_status == 0)); then
  echo "Lint and typecheck passed."
  exit 0
fi

echo "Quality checks failed: lint=$lint_status typecheck=$typecheck_status" >&2
exit 1
