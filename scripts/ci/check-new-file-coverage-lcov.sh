#!/usr/bin/env bash
# Evaluate the 90% new-file coverage gate against a package CI LCOV report.
set -euo pipefail

package="${1:-}"
if [ -z "$package" ]; then
  echo "usage: check-new-file-coverage-lcov.sh <package>" >&2
  exit 1
fi

git fetch origin master
base_sha="${COVERAGE_BASE_SHA:-$(git merge-base origin/master HEAD)}"
lcov_path="${package}/coverage/lcov.info"

bun run check:new-file-coverage \
  --base="$base_sha" \
  --threshold=90 \
  --package="$package" \
  --lcov="$lcov_path"
