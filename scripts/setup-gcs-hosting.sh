#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="flourish-terreno"
REGION="us-east1"

# App definitions: name, bucket, backend-bucket, url-map, ip-name, proxy-name, forwarding-rule
APPS=(
  "demo"
  "frontend-example"
)

DEMO_BUCKET="flourish-terreno-terreno-demo"
DEMO_BACKEND_BUCKET="terreno-demo-backend"
DEMO_URL_MAP="terreno-demo-url-map"
DEMO_IP="terreno-demo-ip"
DEMO_HTTP_PROXY="terreno-demo-http-proxy"
DEMO_FORWARDING_RULE="terreno-demo-forwarding-rule"

FRONTEND_BUCKET="flourish-terreno-terreno-frontend-example"
FRONTEND_BACKEND_BUCKET="terreno-frontend-example-backend"
FRONTEND_URL_MAP="terreno-frontend-example-url-map"
FRONTEND_IP="terreno-frontend-example-ip"
FRONTEND_HTTP_PROXY="terreno-frontend-example-http-proxy"
FRONTEND_FORWARDING_RULE="terreno-frontend-example-forwarding-rule"

echo "=== Terreno GCS + CDN Hosting Setup ==="
echo "Project: $PROJECT_ID"
echo ""

# Ensure we're using the right project
gcloud config set project "$PROJECT_ID"

# --- Helper ---
resource_exists() {
  local type="$1" name="$2"
  shift 2
  gcloud compute "$type" describe "$name" --project="$PROJECT_ID" "$@" &>/dev/null
}

bucket_exists() {
  gsutil ls -b "gs://$1" &>/dev/null
}

# =============================================================================
# Step 1: Create GCS Buckets
# =============================================================================
echo "--- Step 1: Creating GCS buckets ---"

for bucket in "$DEMO_BUCKET" "$FRONTEND_BUCKET"; do
  if bucket_exists "$bucket"; then
    echo "  Bucket gs://$bucket already exists, skipping"
  else
    echo "  Creating gs://$bucket"
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$bucket/"
  fi
done

# =============================================================================
# Step 2: Make buckets publicly readable
# =============================================================================
echo ""
echo "--- Step 2: Setting public read access ---"

for bucket in "$DEMO_BUCKET" "$FRONTEND_BUCKET"; do
  echo "  Setting allUsers:objectViewer on gs://$bucket"
  gsutil iam ch allUsers:objectViewer "gs://$bucket"
done

# =============================================================================
# Step 3: Configure static website hosting (SPA routing)
# =============================================================================
echo ""
echo "--- Step 3: Configuring static website hosting ---"
echo "  NotFoundPage: index.html (SPA fallback)"
echo "  NOTE: MainPageSuffix is NOT set to avoid GCS 301 redirects"
echo "        that break client-side routing (e.g. /demo/ -> /demo/index.html)"

for bucket in "$DEMO_BUCKET" "$FRONTEND_BUCKET"; do
  echo "  Configuring gs://$bucket"
  gsutil web set -e index.html "gs://$bucket"
done

# =============================================================================
# Step 4: Grant service account write access
# =============================================================================
echo ""
echo "--- Step 4: Granting service account access ---"

# Try to find the service account email from gcloud
SA_EMAIL="${GCP_SA_EMAIL:-}"
if [ -z "$SA_EMAIL" ]; then
  echo "  No GCP_SA_EMAIL set. Listing service accounts:"
  gcloud iam service-accounts list --project="$PROJECT_ID" --format="table(email,displayName)"
  echo ""
  read -rp "  Enter service account email: " SA_EMAIL
fi

echo "  Granting objectAdmin to $SA_EMAIL"
for bucket in "$DEMO_BUCKET" "$FRONTEND_BUCKET"; do
  gsutil iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "gs://$bucket"
done

# =============================================================================
# Step 5: Create backend buckets (CDN-enabled)
# =============================================================================
echo ""
echo "--- Step 5: Creating CDN backend buckets ---"

create_backend_bucket() {
  local name="$1" bucket="$2"
  if resource_exists backend-buckets "$name" --global; then
    echo "  Backend bucket $name already exists, skipping"
  else
    echo "  Creating backend bucket $name -> gs://$bucket"
    gcloud compute backend-buckets create "$name" \
      --gcs-bucket-name="$bucket" \
      --enable-cdn
  fi
}

create_backend_bucket "$DEMO_BACKEND_BUCKET" "$DEMO_BUCKET"
create_backend_bucket "$FRONTEND_BACKEND_BUCKET" "$FRONTEND_BUCKET"

# =============================================================================
# Step 6: Create URL maps
# =============================================================================
echo ""
echo "--- Step 6: Creating URL maps ---"

create_url_map() {
  local name="$1" backend="$2"
  if resource_exists url-maps "$name" --global; then
    echo "  URL map $name already exists, skipping"
  else
    echo "  Creating URL map $name -> $backend"
    gcloud compute url-maps create "$name" \
      --default-backend-bucket="$backend"
  fi
}

create_url_map "$DEMO_URL_MAP" "$DEMO_BACKEND_BUCKET"
create_url_map "$FRONTEND_URL_MAP" "$FRONTEND_BACKEND_BUCKET"

# =============================================================================
# Step 7: Reserve static IPs
# =============================================================================
echo ""
echo "--- Step 7: Reserving static IPs ---"

reserve_ip() {
  local name="$1"
  if resource_exists addresses "$name" --global; then
    echo "  IP $name already exists"
  else
    echo "  Reserving global IP $name"
    gcloud compute addresses create "$name" --global
  fi
  local ip
  ip=$(gcloud compute addresses describe "$name" --global --format="value(address)")
  echo "  $name = $ip"
}

reserve_ip "$DEMO_IP"
reserve_ip "$FRONTEND_IP"

# =============================================================================
# Step 8: Create HTTP proxies
# =============================================================================
echo ""
echo "--- Step 8: Creating HTTP proxies ---"

create_http_proxy() {
  local name="$1" url_map="$2"
  if resource_exists target-http-proxies "$name" --global; then
    echo "  HTTP proxy $name already exists, skipping"
  else
    echo "  Creating HTTP proxy $name -> $url_map"
    gcloud compute target-http-proxies create "$name" \
      --url-map="$url_map"
  fi
}

create_http_proxy "$DEMO_HTTP_PROXY" "$DEMO_URL_MAP"
create_http_proxy "$FRONTEND_HTTP_PROXY" "$FRONTEND_URL_MAP"

# =============================================================================
# Step 9: Create forwarding rules
# =============================================================================
echo ""
echo "--- Step 9: Creating forwarding rules ---"

create_forwarding_rule() {
  local name="$1" ip="$2" proxy="$3"
  if resource_exists forwarding-rules "$name" --global; then
    echo "  Forwarding rule $name already exists, skipping"
  else
    echo "  Creating forwarding rule $name ($ip:80 -> $proxy)"
    gcloud compute forwarding-rules create "$name" \
      --address="$ip" \
      --target-http-proxy="$proxy" \
      --global \
      --ports=80
  fi
}

create_forwarding_rule "$DEMO_FORWARDING_RULE" "$DEMO_IP" "$DEMO_HTTP_PROXY"
create_forwarding_rule "$FRONTEND_FORWARDING_RULE" "$FRONTEND_IP" "$FRONTEND_HTTP_PROXY"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=== Setup Complete ==="
echo ""

DEMO_CDN_IP=$(gcloud compute addresses describe "$DEMO_IP" --global --format="value(address)")
FRONTEND_CDN_IP=$(gcloud compute addresses describe "$FRONTEND_IP" --global --format="value(address)")

echo "Demo:"
echo "  Bucket:  gs://$DEMO_BUCKET"
echo "  CDN IP:  http://$DEMO_CDN_IP"
echo ""
echo "Frontend Example:"
echo "  Bucket:  gs://$FRONTEND_BUCKET"
echo "  CDN IP:  http://$FRONTEND_CDN_IP"
echo ""
echo "To add HTTPS, create managed SSL certificates and HTTPS proxies:"
echo "  gcloud compute ssl-certificates create terreno-demo-cert \\"
echo "    --domains=demo.terreno.example.com --global"
echo "  gcloud compute target-https-proxies create terreno-demo-https-proxy \\"
echo "    --ssl-certificates=terreno-demo-cert --url-map=$DEMO_URL_MAP"
echo "  gcloud compute forwarding-rules create terreno-demo-https-forwarding-rule \\"
echo "    --address=$DEMO_IP --target-https-proxy=terreno-demo-https-proxy --global --ports=443"
echo ""
echo "Then point your DNS A records to the IPs above."
