#!/usr/bin/env bash
# Resolve a GitHub PR number for CircleCI preview deploys.
# Prints one of: a numeric PR id, "skip-fork", or "skip-missing".
set -euo pipefail

if [ -n "${CIRCLE_PR_REPONAME:-}" ] && [ "${CIRCLE_PR_REPONAME}" != "${CIRCLE_PROJECT_REPONAME:-}" ]; then
  echo "skip-fork"
  exit 0
fi

if [[ "${CIRCLE_PULL_REQUEST:-}" =~ /pull/([0-9]+) ]]; then
  echo "${BASH_REMATCH[1]}"
  exit 0
fi

if [[ "${CIRCLE_PR_NUMBER:-}" =~ ^[0-9]+$ ]]; then
  echo "${CIRCLE_PR_NUMBER}"
  exit 0
fi

echo "skip-missing"
