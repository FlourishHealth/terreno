#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <demo|frontend|docs> <production|preview> [alias]" >&2
  exit 2
fi

target="$1"
mode="$2"
alias_name="${3:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

case "$target" in
  demo)
    site_id="${NETLIFY_DEMO_SITE_ID:-}"
    bun run --filter '@terreno/ui' compile
    bun run --filter '@terreno/ui' types
    (cd demo && bun run export)
    bash demo/scripts/fix-netlify-assets.sh demo/dist
    publish_dir="demo/dist"
    ;;
  frontend)
    site_id="${NETLIFY_FRONTEND_EXAMPLE_SITE_ID:-}"
    node .github/scripts/compile-workspace-deps.js example-frontend admin-frontend api ai
    bun run --filter '@terreno/admin-frontend' --filter '@terreno/api' --filter '@terreno/ai' compile
    prod_url="https://prod---terreno-backend-example-7knxlrnpqq-uc.a.run.app"
    api_url="${EXPO_PUBLIC_API_URL:-$prod_url}"
    jq --arg url "$api_url" \
      '.expo.extra.BASE_URL = $url | .expo.extra.apiBaseUrl = $url' \
      example-frontend/app.json > example-frontend/app.json.tmp
    mv example-frontend/app.json.tmp example-frontend/app.json
    (cd example-frontend && bun run export)
    bash demo/scripts/fix-netlify-assets.sh example-frontend/dist
    printf '/*    /index.html   200\n' > example-frontend/dist/_redirects
    publish_dir="example-frontend/dist"
    ;;
  docs)
    site_id="${NETLIFY_DOCS_SITE_ID:-}"
    bun run --filter '@terreno/ui' compile
    bun run --filter '@terreno/ui' types
    (cd website && bun run generate:components && bun run generate:api)
    docs_build_args=()
    if [ "$mode" = "preview" ]; then
      docs_build_args+=(--no-minify)
    fi
    (
      cd website
      DOCS_PREVIEW="$([ "$mode" = "preview" ] && echo true || echo false)" \
        DEMO_URL=https://terreno-demo.netlify.app \
        bunx docusaurus build "${docs_build_args[@]}"
    )
    publish_dir="website/build"
    ;;
  *)
    echo "Unknown Netlify target: $target" >&2
    exit 2
    ;;
esac

export NETLIFY_SITE_ID="$site_id"
"$repo_root/scripts/ci/validate-env.sh" NETLIFY_AUTH_TOKEN NETLIFY_SITE_ID

args=(deploy --dir "$publish_dir" --site "$NETLIFY_SITE_ID" --auth "$NETLIFY_AUTH_TOKEN")
if [ "$mode" = "production" ]; then
  args+=(--prod)
elif [ "$mode" = "preview" ]; then
  if [ -z "$alias_name" ]; then
    echo "Preview deploy requires an alias" >&2
    exit 2
  fi
  args+=(--alias "$alias_name")
else
  echo "Unknown Netlify deploy mode: $mode" >&2
  exit 2
fi

bunx --bun netlify-cli@latest "${args[@]}"
