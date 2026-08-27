#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <package-directory> <version> [npm-tag] [release|manual]" >&2
  exit 2
fi

package_directory="$1"
version="$2"
npm_tag="${3:-latest}"
dependency_mode="${4:-release}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

scripts/ci/validate-env.sh NPM_TOKEN
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid package version: $version" >&2
  exit 2
fi

bun run scripts/ci/prepare-package-publish.mjs "$package_directory" "$version" "$dependency_mode"
(cd "$package_directory" && bun install)
node .github/scripts/compile-workspace-deps.js "$package_directory"

if bun -e "
  const pkg = await Bun.file('$package_directory/package.json').json();
  process.exit(pkg.scripts?.compile ? 0 : 1);
"; then
  (cd "$package_directory" && bun run compile)
fi

if bun -e "
  const pkg = await Bun.file('$package_directory/package.json').json();
  process.exit(pkg.scripts?.test ? 0 : 1);
"; then
  (cd "$package_directory" && bun run test)
fi

printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$HOME/.npmrc"
trap 'rm -f "$HOME/.npmrc"' EXIT
(cd "$package_directory" && npm publish --tag "$npm_tag")
