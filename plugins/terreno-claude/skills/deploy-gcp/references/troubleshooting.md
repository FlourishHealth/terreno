# GCP deploy troubleshooting

Symptom → cause → fix for Terreno on Cloud Run + GCS/CDN.

## Runtime constraints

| Symptom | Cause | Fix |
|---------|-------|-----|
| Websockets disconnect every few requests | No session affinity on Cloud Run | Add `--session-affinity` to `gcloud run deploy` |
| Socket connections drop after ~5 minutes | Default Cloud Run request timeout (300s) | Raise `--timeout` (for example `3600`) |
| Log: `FeatureFlag.watch() failed — live updates require MongoDB as a replica set` | `MONGO_URI` points at standalone `mongod` | Use Atlas or a replica set — change streams required |
| First request after idle is slow; sockets reconnect | Cloud Run scaled to zero | Set `--min-instances=1` for user-facing services |
| Browser: `Access to fetch at '...' from origin '...' has been blocked by CORS policy` | `corsOrigin` / Better Auth `trustedOrigins` missing web CDN origin | Add CDN URL to backend CORS and auth config |

## Deploy-time failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `denied: Permission "artifactregistry.repositories.uploadArtifacts" denied` | Deploy identity lacks Artifact Registry write | Grant `roles/artifactregistry.writer` to the deploy service account |
| `Permission denied on secret ...` or `Secret Manager access denied` at cold start | Runtime SA lacks `secretmanager.secretAccessor` | Grant role on each secret or project |
| Cloud Run revision unhealthy; logs show connection refused on health check | Container not listening on `$PORT` | Terreno reads `process.env.PORT` (`api/src/terrenoApp.ts`); set `ENV PORT=3000` in Dockerfile and `--port=3000` on deploy |
| Web app loads but API calls go to `localhost` | `EXPO_PUBLIC_API_URL` not set at build time | Rebuild with `EXPO_PUBLIC_API_URL=$SERVICE_URL bun run export` |
| CDN serves old UI after deploy | CDN cache not invalidated | `gcloud compute url-maps invalidate-cdn-cache SITE-url-map --path "/*" --async` |

## Health check

| Symptom | Cause | Fix |
|---------|-------|-----|
| `curl $SERVICE_URL/health` returns `503` with `"database": "disconnected"` | MongoDB unreachable from Cloud Run | Check `MONGO_URI`, VPC/Atlas IP allowlist, and credentials |
