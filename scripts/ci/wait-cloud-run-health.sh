#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 BASE_URL [TIMEOUT_SECONDS]" >&2
  exit 2
fi

base_url="${1%/}"
timeout_seconds="${2:-300}"
interval_seconds="${WAIT_INTERVAL_SECONDS:-5}"

if ! [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "TIMEOUT_SECONDS must be a positive integer" >&2
  exit 2
fi

health_url="${base_url}/health"
deadline=$((SECONDS + timeout_seconds))
response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

last_body=""
last_status="unavailable"

while [ "$SECONDS" -lt "$deadline" ]; do
  if last_status="$(
    curl \
      --connect-timeout 10 \
      --max-time 20 \
      --output "$response_file" \
      --silent \
      --show-error \
      --write-out "%{http_code}" \
      "$health_url"
  )"; then
    last_body="$(cat "$response_file")"
    if [ "$last_status" = "200" ] && printf "%s" "$last_body" | node -e '
      let input = "";
      process.stdin.on("data", (chunk) => {
        input += chunk;
      });
      process.stdin.on("end", () => {
        try {
          process.exit(JSON.parse(input).healthy === true ? 0 : 1);
        } catch {
          process.exit(1);
        }
      });
    '; then
      echo "Cloud Run preview is healthy: $health_url"
      exit 0
    fi
  else
    last_status="unreachable"
    last_body="$(cat "$response_file" 2>/dev/null || true)"
  fi

  sleep "$interval_seconds"
done

echo "Timed out waiting for Cloud Run preview health after ${timeout_seconds}s: $health_url" >&2
echo "Last response (status ${last_status}): ${last_body:-<empty>}" >&2
exit 1
