---
name: deploy-gcp
description: Deploy a Terreno app to GCP — Cloud Run backend and GCS+CDN static web. Trigger phrases include "deploy to GCP", "deploy to Cloud Run", and "ship the backend".
targets: ['*']
---

# Deploy to GCP

Deploy `example-backend` (or a bootstrapped `backend/`) to Cloud Run and the web export to GCS + CDN.

**Never deploy to a project the user did not name in the request.** Never create or modify secrets without echoing which secret names will change.

## When to use

- User asks to deploy a Terreno backend or full stack to Google Cloud
- User names a specific GCP `$PROJECT_ID` and wants Cloud Run + static web hosting

## When not to use

- User has not named a target GCP project
- User wants Vercel, Netlify-only, or non-GCP hosting
- User wants Terraform apply without explicit confirmation

## Preflight checks

1. **Project layout** — detect monorepo (`example-backend/`, `example-frontend/`) vs bootstrapped app (`backend/`, `frontend/`).
2. **gcloud** — `gcloud config get-value project` must match the user-named project (or set it with user confirmation).
3. **APIs** — verify `run.googleapis.com`, `artifactregistry.googleapis.com`, `secretmanager.googleapis.com` are enabled.
4. **MongoDB** — `MONGO_URI` must point at a replica set (Atlas or `replSet=`). Standalone `mongod` breaks change streams.
5. **Web build** — confirm `EXPO_PUBLIC_API_URL` will be set to the Cloud Run URL **before** `bun run export`.

## Plan and confirm (required)

Before any mutating `gcloud`, `docker push`, or `gsutil` command, print:

- Target `$PROJECT_ID`, `$REGION`, `$SERVICE_NAME`
- Web bucket `$WEB_BUCKET` and CDN site name
- Every secret to create or update (`MONGO_URI`, `TOKEN_SECRET`, etc.)
- Every resource to create or update (Artifact Registry repo, Cloud Run service, GCS bucket, CDN resources)

**Stop and require explicit user confirmation** before proceeding.

## Backend deploy

Follow [docs/how-to/deploy-backend-to-cloud-run.md](../../../../docs/how-to/deploy-backend-to-cloud-run.md):

1. Create Artifact Registry repository
2. `docker build -f example-backend/Dockerfile .` from repo root
3. Push image to `$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME`
4. Create Secret Manager secrets (values out of band)
5. Create runtime service account with `secretmanager.secretAccessor`
6. `gcloud run deploy` with `--session-affinity`, `--timeout=3600`, `--min-instances=1`, `--set-secrets`, `--port=3000`

## Frontend deploy

Follow [docs/how-to/deploy-web-to-gcs-cdn.md](../../../../docs/how-to/deploy-web-to-gcs-cdn.md):

1. `EXPO_PUBLIC_API_URL=$SERVICE_URL bun run export` in the frontend package
2. Upload `dist/` to `$WEB_BUCKET` with correct cache headers
3. Run `./scripts/setup-gcs-hosting.sh --project ... --site-name ... --bucket ... --domain ...` if CDN not provisioned
4. Invalidate CDN cache on the URL map

## Verification

```bash
curl -s "$SERVICE_URL/health" | jq .
```

Expect `"healthy": true`. Fetch the web root URL and confirm the SPA loads and API calls hit `$SERVICE_URL`.

## Troubleshooting

See [references/troubleshooting.md](references/troubleshooting.md).
