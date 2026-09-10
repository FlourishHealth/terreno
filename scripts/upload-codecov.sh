#!/usr/bin/env bash
# Upload a package's merged coverage/lcov.info to Codecov with a distinct flag.
# Skip (exit 0) when the report is missing or CODECOV_TOKEN is unset so CI can
# land before maintainers configure the secret.
set -euo pipefail

flag="${1:-}"
file="${2:-coverage/lcov.info}"

if [ -z "$flag" ]; then
  echo "usage: upload-codecov.sh <flag> [lcov-path]" >&2
  exit 1
fi

if [ ! -f "$file" ]; then
  echo "No ${file}; skipping Codecov upload for flag=${flag}"
  exit 0
fi

if [ -z "${CODECOV_TOKEN:-}" ]; then
  echo "CODECOV_TOKEN unset; skipping Codecov upload for flag=${flag}."
  echo "Maintainers: set CODECOV_TOKEN in CircleCI project env and as a GitHub Actions secret."
  echo "Public repos: token is required unless the Codecov org disables token auth for public repos."
  exit 0
fi

uploader="/tmp/codecov-uploader"
if [ ! -x "$uploader" ]; then
  curl -fsSL -o "$uploader" "https://uploader.codecov.io/latest/linux/codecov"
  chmod +x "$uploader"
fi

"$uploader" \
  -t "$CODECOV_TOKEN" \
  -f "$file" \
  -F "$flag" \
  -n "$flag" \
  -Z
