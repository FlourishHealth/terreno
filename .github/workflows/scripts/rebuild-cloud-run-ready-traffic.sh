#!/usr/bin/env bash
# Drop not-Ready tagged Cloud Run revisions from traffic without --remove-tags.
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 SERVICE REGION" >&2
  exit 1
fi

SERVICE="$1"
REGION="$2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

service_json="$(mktemp)"
revisions_json="$(mktemp)"
plan_json="$(mktemp)"
cleanup() {
  rm -f "$service_json" "$revisions_json" "$plan_json"
}
trap cleanup EXIT

gcloud run services describe "$SERVICE" \
  --region="$REGION" \
  --format=json >"$service_json"

gcloud run revisions list \
  --service="$SERVICE" \
  --region="$REGION" \
  --format=json >"$revisions_json"

node "$ROOT/.github/scripts/prune-cloud-run-not-ready-traffic.js" \
  --json \
  "$service_json" \
  "$revisions_json" >"$plan_json"

mapfile -t flags < <(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); for (const f of p.flags) process.stdout.write(f+"\n")' "$plan_json")

apply_traffic() {
  gcloud run services update-traffic "$SERVICE" \
    --region="$REGION" \
    --quiet \
    "${flags[@]}"
}

if apply_traffic; then
  exit 0
fi

echo "update-traffic with rebuilt tags failed; deleting not-Ready tagged revisions" >&2
mapfile -t dropped < <(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); for (const n of p.dropped||[]) process.stdout.write(n+"\n")' "$plan_json")
for revision in "${dropped[@]}"; do
  if [ -z "$revision" ]; then
    continue
  fi
  gcloud run revisions delete "$revision" \
    --region="$REGION" \
    --quiet || true
done

apply_traffic
