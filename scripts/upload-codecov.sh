#!/usr/bin/env bash
# Upload a package's merged coverage/lcov.info to Codecov with a distinct flag.
# Skip (exit 0) when the report is missing or CODECOV_TOKEN is unset so CI can
# land before maintainers configure the secret.
set -euo pipefail

flag="${1:-}"
file="${2:-coverage/lcov.info}"
# Pinned linux uploader digest (uploader.codecov.io/latest/linux/codecov).
CODECOV_UPLOADER_SHA256="${CODECOV_UPLOADER_SHA256:-b37359013b48fbc3b0790d59fc474a52a260fb96e28e1b2c2ae001dc9b9cc996}"
CODECOV_UPLOADER_URL="${CODECOV_UPLOADER_URL:-https://uploader.codecov.io/latest/linux/codecov}"

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

uploader="${CODECOV_UPLOADER_PATH:-/tmp/codecov-uploader}"
needs_download=1
if [ -x "$uploader" ]; then
  actual="$(sha256sum "$uploader" | awk '{print $1}')"
  if [ "$actual" = "$CODECOV_UPLOADER_SHA256" ]; then
    needs_download=0
  fi
fi

if [ "$needs_download" -eq 1 ]; then
  curl -fsSL -o "$uploader" "$CODECOV_UPLOADER_URL"
  chmod +x "$uploader"
fi

actual="$(sha256sum "$uploader" | awk '{print $1}')"
if [ "$actual" != "$CODECOV_UPLOADER_SHA256" ]; then
  echo "Codecov uploader checksum mismatch." >&2
  echo "expected ${CODECOV_UPLOADER_SHA256}" >&2
  echo "actual   ${actual}" >&2
  rm -f "$uploader"
  exit 1
fi

"$uploader" \
  -t "$CODECOV_TOKEN" \
  -f "$file" \
  -F "$flag" \
  -n "$flag" \
  -Z
