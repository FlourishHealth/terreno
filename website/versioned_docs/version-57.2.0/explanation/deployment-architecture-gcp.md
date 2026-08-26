# GCP deployment architecture

Reference topology for hosting a Terreno full-stack app on Google Cloud Platform.

This page is conceptual — commands live in the [how-to guides](../how-to/deploy-to-gcp.md).

## Topology

```mermaid
flowchart TD
  U["User<br/>iOS / Android / Web"]
  CDN["Cloud CDN + GCS bucket<br/>expo export -p web output"]
  CR["Cloud Run<br/>@terreno/api backend"]
  SM["Secret Manager<br/>auth secrets, MONGO_URI"]
  AT["MongoDB Atlas<br/>replica set (change streams)"]
  GCS["GCS bucket<br/>user file uploads"]
  AR["Artifact Registry<br/>backend image"]
  U -->|"web"| CDN
  U -->|"native app"| CR
  CDN -->|"API calls"| CR
  CR --> SM
  CR --> AT
  CR --> GCS
  AR --> CR
```

## Component responsibilities

| Component | Role |
|-----------|------|
| **Artifact Registry** | Stores versioned backend container images built from `example-backend/Dockerfile` |
| **Cloud Run** | Runs the long-lived `@terreno/api` process (HTTP + Socket.io) |
| **Secret Manager** | Holds `MONGO_URI`, JWT secrets, and other credentials — mounted as env vars |
| **MongoDB Atlas** | Primary database; must be a replica set for change streams (realtime, feature flags) |
| **GCS (web bucket)** | Serves static web export; CDN caches at the edge |
| **GCS (uploads bucket)** | Private object storage for user uploads via `@terreno/api` file plugins |

## Why Cloud Run (not App Engine or GKE)

| Option | Tradeoff |
|--------|----------|
| **Cloud Run** | Pay-per-use, minimal ops, supports WebSockets with session affinity — fits Terreno's socket + HTTP model |
| **App Engine** | Similar serverless model but less flexible for custom containers and long timeouts |
| **GKE** | Full control but requires cluster management — overkill for a single Terreno backend |

## Why Atlas (not self-hosted Mongo on GCP)

| Option | Tradeoff |
|--------|----------|
| **MongoDB Atlas** | Managed replica sets, backups, and change streams out of the box |
| **Self-hosted on Compute Engine** | You operate replica set elections, backups, and upgrades — documented as out of scope for launch |

## Static web vs server-rendered

| Approach | Tradeoff |
|----------|----------|
| **GCS + CDN (static export)** | Cheapest, simplest, works today with Expo `single`/`static` output — no SSR or API routes |
| **Node/Bun server (SSR)** | Better SEO and API routes — requires Expo SDK ≥ 55; not available in the current `~54` catalog |

Native iOS and Android apps call Cloud Run directly; only the web client uses the CDN origin.

## Related

- [Deployment baseline](deployment-baseline.md) — seven requirements every host must satisfy
- [Deploy to GCP](../how-to/deploy-to-gcp.md) — step-by-step guides
