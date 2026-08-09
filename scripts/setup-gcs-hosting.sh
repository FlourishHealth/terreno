#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: setup-gcs-hosting.sh --project PROJECT_ID --site-name SITE_NAME --bucket BUCKET_NAME --domain DOMAIN [options]

Provision GCS + Cloud CDN resources for one static Terreno web site.

Required:
  --project PROJECT_ID     GCP project ID
  --site-name SITE_NAME    Prefix for CDN resource names (e.g. my-app)
  --bucket BUCKET_NAME     GCS bucket name for static files
  --domain DOMAIN          Public hostname for the managed TLS certificate

Options:
  --region REGION          GCS bucket region (default: us-central1)
  --service-account EMAIL  Grant objectAdmin on the bucket (optional)
  --dry-run                Print commands without executing
  -h, --help               Show this help

Example:
  ./scripts/setup-gcs-hosting.sh \
    --project my-gcp-project \
    --site-name terreno-web \
    --bucket my-terreno-web-bucket \
    --domain app.example.com \
    --dry-run
EOF
}

PROJECT_ID=""
SITE_NAME=""
BUCKET=""
DOMAIN=""
REGION="us-central1"
SA_EMAIL=""
DRY_RUN=false

run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --site-name)
      SITE_NAME="$2"
      shift 2
      ;;
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --service-account)
      SA_EMAIL="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$PROJECT_ID" ] || [ -z "$SITE_NAME" ] || [ -z "$BUCKET" ] || [ -z "$DOMAIN" ]; then
  echo "Error: --project, --site-name, --bucket, and --domain are required." >&2
  usage >&2
  exit 1
fi

BACKEND_BUCKET="${SITE_NAME}-backend"
URL_MAP="${SITE_NAME}-url-map"
IP_NAME="${SITE_NAME}-ip"
SSL_CERTIFICATE="${SITE_NAME}-cert"
HTTPS_PROXY="${SITE_NAME}-https-proxy"
HTTPS_FORWARDING_RULE="${SITE_NAME}-https-forwarding-rule"
REDIRECT_URL_MAP="${SITE_NAME}-http-redirect-url-map"
HTTP_PROXY="${SITE_NAME}-http-proxy"
HTTP_FORWARDING_RULE="${SITE_NAME}-forwarding-rule"

echo "=== Terreno GCS + CDN Hosting Setup ==="
echo "Project:   $PROJECT_ID"
echo "Site:      $SITE_NAME"
echo "Bucket:    $BUCKET"
echo "Domain:    $DOMAIN"
echo "Region:    $REGION"
echo ""

run_cmd gcloud config set project "$PROJECT_ID"
run_cmd gcloud services enable compute.googleapis.com --project="$PROJECT_ID"

resource_exists() {
  local type="$1"
  local name="$2"
  shift 2
  if [ "$DRY_RUN" = true ]; then
    return 1
  fi
  gcloud compute "$type" describe "$name" --project="$PROJECT_ID" "$@" &>/dev/null
}

bucket_exists() {
  if [ "$DRY_RUN" = true ]; then
    return 1
  fi
  gsutil ls -b "gs://$1" &>/dev/null
}

echo "--- Step 1: Create GCS bucket ---"
if bucket_exists "$BUCKET"; then
  echo "  Bucket gs://$BUCKET already exists, skipping"
else
  run_cmd gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$BUCKET/"
fi

echo ""
echo "--- Step 2: Public read access ---"
run_cmd gsutil iam ch allUsers:objectViewer "gs://$BUCKET"

echo ""
echo "--- Step 3: SPA routing (notFoundPage=index.html) ---"
run_cmd gsutil web set -e index.html "gs://$BUCKET"

if [ -n "$SA_EMAIL" ]; then
  echo ""
  echo "--- Step 4: Service account write access ---"
  run_cmd gsutil iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "gs://$BUCKET"
fi

echo ""
echo "--- Step 5: CDN backend bucket ---"
if resource_exists backend-buckets "$BACKEND_BUCKET" --global; then
  echo "  Backend bucket $BACKEND_BUCKET already exists, skipping"
else
  run_cmd gcloud compute backend-buckets create "$BACKEND_BUCKET" \
    --gcs-bucket-name="$BUCKET" \
    --enable-cdn \
    --no-negative-caching \
    --project="$PROJECT_ID"
fi

echo ""
echo "--- Step 6: URL map ---"
if resource_exists url-maps "$URL_MAP" --global; then
  echo "  URL map $URL_MAP already exists, skipping"
else
  run_cmd gcloud compute url-maps create "$URL_MAP" \
    --default-backend-bucket="$BACKEND_BUCKET" \
    --project="$PROJECT_ID"
fi

echo ""
echo "--- Step 7: Static IP ---"
if resource_exists addresses "$IP_NAME" --global; then
  echo "  IP $IP_NAME already exists"
else
  run_cmd gcloud compute addresses create "$IP_NAME" --global --project="$PROJECT_ID"
fi

if [ "$DRY_RUN" = false ]; then
  IP_ADDR=$(gcloud compute addresses describe "$IP_NAME" --global --project="$PROJECT_ID" --format="value(address)")
  echo "  $IP_NAME = $IP_ADDR"
else
  echo "[dry-run] gcloud compute addresses describe $IP_NAME --global --format='value(address)'"
fi

echo ""
echo "--- Step 8: Managed TLS certificate ---"
if resource_exists ssl-certificates "$SSL_CERTIFICATE" --global; then
  echo "  TLS certificate $SSL_CERTIFICATE already exists, skipping"
else
  run_cmd gcloud compute ssl-certificates create "$SSL_CERTIFICATE" \
    --domains="$DOMAIN" \
    --global \
    --project="$PROJECT_ID"
fi

echo ""
echo "--- Step 9: HTTPS proxy ---"
if resource_exists target-https-proxies "$HTTPS_PROXY" --global; then
  echo "  HTTPS proxy $HTTPS_PROXY already exists, skipping"
else
  run_cmd gcloud compute target-https-proxies create "$HTTPS_PROXY" \
    --url-map="$URL_MAP" \
    --ssl-certificates="$SSL_CERTIFICATE" \
    --project="$PROJECT_ID"
fi

echo ""
echo "--- Step 10: HTTPS forwarding rule ---"
if resource_exists forwarding-rules "$HTTPS_FORWARDING_RULE" --global; then
  echo "  Forwarding rule $HTTPS_FORWARDING_RULE already exists, skipping"
else
  run_cmd gcloud compute forwarding-rules create "$HTTPS_FORWARDING_RULE" \
    --address="$IP_NAME" \
    --target-https-proxy="$HTTPS_PROXY" \
    --global \
    --ports=443 \
    --project="$PROJECT_ID"
fi

create_redirect_url_map() {
  # gcloud exposes defaultUrlRedirect only through an imported spec, not
  # through url-maps create flags.
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] gcloud compute url-maps import $REDIRECT_URL_MAP --global --project=$PROJECT_ID --source=- <<spec"
    echo "[dry-run]   name: $REDIRECT_URL_MAP"
    echo "[dry-run]   defaultUrlRedirect: {httpsRedirect: true, redirectResponseCode: MOVED_PERMANENTLY_DEFAULT}"
    return
  fi
  gcloud compute url-maps import "$REDIRECT_URL_MAP" \
    --global \
    --project="$PROJECT_ID" \
    --quiet \
    --source=/dev/stdin <<SPEC
name: $REDIRECT_URL_MAP
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
SPEC
}

echo ""
echo "--- Step 11: Redirect HTTP to HTTPS ---"
# Without a port 80 listener, http://$DOMAIN fails to connect instead of
# redirecting. Serve a 301 there rather than the bundle itself.
if resource_exists url-maps "$REDIRECT_URL_MAP" --global; then
  echo "  Redirect URL map $REDIRECT_URL_MAP already exists, skipping"
else
  create_redirect_url_map
fi

if resource_exists target-http-proxies "$HTTP_PROXY" --global; then
  echo "  HTTP proxy $HTTP_PROXY already exists, skipping"
else
  run_cmd gcloud compute target-http-proxies create "$HTTP_PROXY" \
    --url-map="$REDIRECT_URL_MAP" \
    --project="$PROJECT_ID"
fi

if resource_exists forwarding-rules "$HTTP_FORWARDING_RULE" --global; then
  echo "  Forwarding rule $HTTP_FORWARDING_RULE already exists, skipping"
else
  run_cmd gcloud compute forwarding-rules create "$HTTP_FORWARDING_RULE" \
    --address="$IP_NAME" \
    --target-http-proxy="$HTTP_PROXY" \
    --global \
    --ports=80 \
    --project="$PROJECT_ID"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Bucket:  gs://$BUCKET"
echo "URL map: $URL_MAP (use for CDN cache invalidation)"
echo "URL:      https://$DOMAIN (HTTP 301-redirects to HTTPS)"
echo ""
echo "Point $DOMAIN at the static IP above. Managed certificates only start provisioning"
echo "once DNS resolves to the load balancer, and can take up to ~60 minutes. Wait for ACTIVE:"
echo "  gcloud compute ssl-certificates describe $SSL_CERTIFICATE --global \\"
echo "    --project=$PROJECT_ID --format='value(managed.status)'"
