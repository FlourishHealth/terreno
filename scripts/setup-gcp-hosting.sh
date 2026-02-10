#!/usr/bin/env bash
set -euo pipefail

# Idempotent setup script for GCS + Cloud CDN static hosting.
# Creates infrastructure for both demo and example-frontend apps.
#
# Prerequisites:
#   - gcloud CLI authenticated with sufficient permissions
#   - GCP project set: gcloud config set project <PROJECT_ID>
#
# Required SA roles (one-time setup):
#   roles/storage.admin, roles/compute.loadBalancerAdmin, roles/compute.networkAdmin
#
# Usage:
#   ./scripts/setup-gcp-hosting.sh

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: No GCP project set. Run: gcloud config set project <PROJECT_ID>"
  exit 1
fi

echo "Using project: $PROJECT_ID"

# App definitions: name, bucket suffix
APPS=(
  "demo:terreno-demo"
  "frontend-example:terreno-frontend-example"
)

for APP_ENTRY in "${APPS[@]}"; do
  IFS=':' read -r APP_NAME BUCKET_SUFFIX <<< "$APP_ENTRY"
  BUCKET="${PROJECT_ID}-${BUCKET_SUFFIX}"
  BACKEND_BUCKET="$BUCKET_SUFFIX-backend"
  URL_MAP="$BUCKET_SUFFIX-url-map"
  HTTP_PROXY="$BUCKET_SUFFIX-http-proxy"
  FORWARDING_RULE="$BUCKET_SUFFIX-http-rule"
  STATIC_IP="$BUCKET_SUFFIX-ip"

  echo ""
  echo "=== Setting up $APP_NAME (bucket: $BUCKET) ==="

  # --- GCS Bucket ---
  if gsutil ls -b "gs://$BUCKET" &>/dev/null; then
    echo "Bucket gs://$BUCKET already exists"
  else
    echo "Creating bucket gs://$BUCKET"
    gsutil mb -l us-east1 "gs://$BUCKET"
  fi

  # Website configuration: SPA rewrite via notFoundPage
  echo "Configuring website settings (mainPage + notFoundPage for SPA)"
  gsutil web set -m index.html -e index.html "gs://$BUCKET"

  # Public read access
  echo "Setting public read access"
  gsutil iam ch allUsers:objectViewer "gs://$BUCKET"

  # --- Static IP ---
  if gcloud compute addresses describe "$STATIC_IP" --global &>/dev/null; then
    echo "Static IP $STATIC_IP already exists"
  else
    echo "Creating static IP $STATIC_IP"
    gcloud compute addresses create "$STATIC_IP" --global
  fi

  IP_ADDRESS=$(gcloud compute addresses describe "$STATIC_IP" --global --format='get(address)')
  echo "Static IP: $IP_ADDRESS"

  # --- Backend Bucket (CDN) ---
  if gcloud compute backend-buckets describe "$BACKEND_BUCKET" &>/dev/null; then
    echo "Backend bucket $BACKEND_BUCKET already exists"
  else
    echo "Creating backend bucket $BACKEND_BUCKET with CDN"
    gcloud compute backend-buckets create "$BACKEND_BUCKET" \
      --gcs-bucket-name="$BUCKET" \
      --enable-cdn \
      --cache-mode=CACHE_ALL_STATIC \
      --default-ttl=86400
  fi

  # --- URL Map ---
  if gcloud compute url-maps describe "$URL_MAP" &>/dev/null; then
    echo "URL map $URL_MAP already exists"
  else
    echo "Creating URL map $URL_MAP"
    gcloud compute url-maps create "$URL_MAP" \
      --default-backend-bucket="$BACKEND_BUCKET"
  fi

  # --- HTTP Proxy ---
  if gcloud compute target-http-proxies describe "$HTTP_PROXY" &>/dev/null; then
    echo "HTTP proxy $HTTP_PROXY already exists"
  else
    echo "Creating HTTP proxy $HTTP_PROXY"
    gcloud compute target-http-proxies create "$HTTP_PROXY" \
      --url-map="$URL_MAP"
  fi

  # --- Forwarding Rule ---
  if gcloud compute forwarding-rules describe "$FORWARDING_RULE" --global &>/dev/null; then
    echo "Forwarding rule $FORWARDING_RULE already exists"
  else
    echo "Creating forwarding rule $FORWARDING_RULE"
    gcloud compute forwarding-rules create "$FORWARDING_RULE" \
      --global \
      --address="$STATIC_IP" \
      --target-http-proxy="$HTTP_PROXY" \
      --ports=80
  fi

  # --- HTTPS (uncomment when custom domains are ready) ---
  # HTTPS_PROXY="$BUCKET_SUFFIX-https-proxy"
  # SSL_CERT="$BUCKET_SUFFIX-cert"
  # HTTPS_RULE="$BUCKET_SUFFIX-https-rule"
  #
  # gcloud compute ssl-certificates create "$SSL_CERT" \
  #   --domains="your-domain.com" \
  #   --global
  #
  # gcloud compute target-https-proxies create "$HTTPS_PROXY" \
  #   --url-map="$URL_MAP" \
  #   --ssl-certificates="$SSL_CERT"
  #
  # gcloud compute forwarding-rules create "$HTTPS_RULE" \
  #   --global \
  #   --address="$STATIC_IP" \
  #   --target-https-proxy="$HTTPS_PROXY" \
  #   --ports=443

  echo "=== $APP_NAME setup complete ==="
  echo "  HTTP: http://$IP_ADDRESS"
  echo "  Bucket: gs://$BUCKET"
done

echo ""
echo "Infrastructure setup complete."
echo "Next steps:"
echo "  1. Push to a PR branch to test preview deploys"
echo "  2. Merge to master to test production deploys"
echo "  3. When ready for custom domains, uncomment the HTTPS sections above"
