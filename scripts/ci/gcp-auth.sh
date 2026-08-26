#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/validate-env.sh" \
  CIRCLE_OIDC_TOKEN_V2 \
  GCP_PROJECT_ID \
  GCP_SERVICE_ACCOUNT \
  GCP_WIF_PROVIDER_PROD

token_file="$(mktemp)"
credentials_file="$(mktemp)"
trap 'rm -f "$token_file" "$credentials_file"' EXIT
printf '%s' "$CIRCLE_OIDC_TOKEN_V2" > "$token_file"

gcloud iam workload-identity-pools create-cred-config "$GCP_WIF_PROVIDER_PROD" \
  --service-account="$GCP_SERVICE_ACCOUNT" \
  --credential-source-file="$token_file" \
  --output-file="$credentials_file"
gcloud auth login --brief --cred-file="$credentials_file"
gcloud config set project "$GCP_PROJECT_ID"
