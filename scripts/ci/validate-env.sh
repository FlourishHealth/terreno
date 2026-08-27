#!/usr/bin/env bash
set -euo pipefail

missing=()
for name in "$@"; do
  if [ -z "${!name:-}" ]; then
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -ne 0 ]; then
  echo "Missing required environment variables: ${missing[*]}" >&2
  exit 1
fi
