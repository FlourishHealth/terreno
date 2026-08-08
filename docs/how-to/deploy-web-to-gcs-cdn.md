# Deploy web to GCS + CDN

Host a static Terreno web export on Google Cloud Storage with Cloud CDN.

Replace placeholders: `$PROJECT_ID`, `$REGION`, `$WEB_BUCKET`, `$SITE_NAME`.

## Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- Backend deployed and CORS configured — see [Deploy backend to Cloud Run](deploy-backend-to-cloud-run.md)
- [Build for web](build-for-web.md) completed with the correct `EXPO_PUBLIC_API_URL`

## 1. Build the web bundle

Set the API URL **before** export — it is inlined into the bundle:

```bash
cd example-frontend
EXPO_PUBLIC_API_URL=https://api.example.com bun run export
```

The export script is `bun expo export --platform web` (see `example-frontend/package.json`).

Output is in `dist/`.

## 2. Create the GCS bucket

```bash
gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$WEB_BUCKET/"
```

## 3. Configure SPA routing

Client-side routes require `index.html` for unknown paths:

```bash
gsutil web set -e index.html "gs://$WEB_BUCKET"
```

Do not set `MainPageSuffix` — GCS 301 redirects break client-side routing.

## 4. Upload the build

```bash
gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" \
  rsync -r -d -x '.*\.html$' \
  dist/ "gs://$WEB_BUCKET/"

gsutil -h "Cache-Control:no-cache, no-store, must-revalidate" \
  cp dist/index.html "gs://$WEB_BUCKET/index.html"
```

## 5. Create CDN resources

Five resources connect the bucket to a global IP:

```bash
# Backend bucket (CDN-enabled)
gcloud compute backend-buckets create "${SITE_NAME}-backend" \
  --gcs-bucket-name="$WEB_BUCKET" \
  --enable-cdn \
  --no-negative-caching \
  --project="$PROJECT_ID"

# URL map
gcloud compute url-maps create "${SITE_NAME}-url-map" \
  --default-backend-bucket="${SITE_NAME}-backend" \
  --project="$PROJECT_ID"

# Static IP
gcloud compute addresses create "${SITE_NAME}-ip" --global --project="$PROJECT_ID"

# HTTP proxy
gcloud compute target-http-proxies create "${SITE_NAME}-http-proxy" \
  --url-map="${SITE_NAME}-url-map" \
  --project="$PROJECT_ID"

# Forwarding rule
gcloud compute forwarding-rules create "${SITE_NAME}-forwarding-rule" \
  --address="${SITE_NAME}-ip" \
  --target-http-proxy="${SITE_NAME}-http-proxy" \
  --global \
  --ports=80 \
  --project="$PROJECT_ID"
```

Or run the parameterized script:

```bash
./scripts/setup-gcs-hosting.sh \
  --project "$PROJECT_ID" \
  --site-name "$SITE_NAME" \
  --bucket "$WEB_BUCKET"
```

## 6. Point DNS

```bash
gcloud compute addresses describe "${SITE_NAME}-ip" --global \
  --project="$PROJECT_ID" --format='value(address)'
```

Create an A record for your domain pointing at that IP. For HTTPS, add a managed SSL certificate and HTTPS proxy (see script output).

## 7. Invalidate cache after deploy

```bash
gcloud compute url-maps invalidate-cdn-cache "${SITE_NAME}-url-map" \
  --path "/*" --async --project="$PROJECT_ID"
```

## Static-only path

This guide hosts the `expo export -p web` output as static files. Server-rendered web (SSR, API routes) requires Expo SDK ≥ 55 — see [Web SSR and admin SPA](../implementationPlans/web-ssr-and-admin-spa.md).

## Related

- [Build for web](build-for-web.md)
- [Deploy backend to Cloud Run](deploy-backend-to-cloud-run.md)
- [GCP architecture](../explanation/deployment-architecture-gcp.md)
