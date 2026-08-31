#!/usr/bin/env bash
# Apply or clear git HTTP extraheader auth for ROADMAP_PROJECT_TOKEN.
# Masks the derived basic-auth value the way actions/checkout does, so a
# ruleset-bypass PAT cannot leak unredacted if git config or headers are logged.
set -euo pipefail

if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN is required" >&2
  exit 1
fi

mode="${1:-apply}"
auth="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
echo "::add-mask::${auth}"

if [ "$mode" = "clear" ]; then
  git config --local --unset-all http.https://github.com/.extraheader || true
  exit 0
fi

git config --local http.https://github.com/.extraheader "AUTHORIZATION: basic ${auth}"
