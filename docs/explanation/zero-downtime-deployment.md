# Zero-Downtime Deployment Pattern

This document explains Terreno's zero-downtime deployment strategy for static web applications on Google Cloud Storage with CDN caching.

## The Problem

When deploying a new version of a single-page application (SPA) with content-hashed assets, a naive deployment can create a window where users receive 404 errors:

``````
Time: T0 (Before Deploy)
  CDN Edge Cache: index.html (references bundle-v1-abc.js)
  GCS Bucket: index.html + bundle-v1-abc.js

Time: T1 (Naive Deploy - rsync with -d)
  rsync -d uploads index.html (references bundle-v2-def.js)
  rsync -d DELETES bundle-v1-abc.js
  
  CDN Edge Cache: STILL SERVES index.html (references bundle-v1-abc.js)
  GCS Bucket: index.html + bundle-v2-def.js
  
  User Request → CDN Edge → Serves cached index.html → Requests bundle-v1-abc.js → 404!

Time: T2 (After Cache Invalidation)
  CDN purges old index.html
  New requests get index.html (references bundle-v2-def.js)
  ✅ Works
``````

**Root Cause**: The CDN cache holds the old `index.html` referencing the old bundle, but `gsutil rsync -d` immediately deletes the old bundle. This creates a window (T1 to T2) where users get 404 errors.

## The Solution: 4-Step Deployment Sequence

Terreno uses a zero-downtime deployment pattern that ensures old assets remain available until all CDN edges serve the new `index.html`:

### Step 1: Upload New Assets (Additive Only)

``````bash
gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" \
  rsync -r -x '_previews/.*|.*\.html$' \
  dist/ "gs://$BUCKET/"
``````

- **Key**: No `-d` flag — does not delete old files
- **Effect**: Both old (`bundle-v1-abc.js`) and new (`bundle-v2-def.js`) bundles exist in GCS
- **Safety**: Old `index.html` references still work

### Step 2: Upload New index.html

``````bash
gsutil -h "Cache-Control:no-cache, no-store, must-revalidate" \
  cp dist/index.html "gs://$BUCKET/index.html"
``````

- **Key**: Overwrites the origin `index.html`
- **Effect**: New requests to GCS (cache misses) get the new `index.html`
- **Safety**: CDN edges still serve cached old `index.html` until invalidated

### Step 3: Invalidate CDN Cache (Synchronous)

``````bash
gcloud compute url-maps invalidate-cdn-cache terreno-demo-url-map \
  --path "/index.html"
gcloud compute url-maps invalidate-cdn-cache terreno-demo-url-map \
  --path "/"
``````

- **Key**: Targeted invalidation (`/index.html` and `/` instead of `/*`)
- **Effect**: Purges stale `index.html` from all CDN edges
- **Safety**: After this completes, all new requests fetch the new `index.html` from GCS

### Step 4: Clean Up Old Assets

``````bash
gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" \
  rsync -r -d -x '_previews/.*|.*\.html$' \
  dist/ "gs://$BUCKET/"
``````

- **Key**: Now uses `-d` flag to delete old files
- **Effect**: Removes `bundle-v1-abc.js` and other old assets
- **Safety**: All CDN edges and users have the new `index.html`, so old bundles are no longer referenced

## Why This Works

| Deployment Phase | Old index.html | New index.html | Old Bundle | New Bundle | User Experience |
|------------------|----------------|----------------|------------|------------|-----------------|
| **Before Deploy** | Cached at CDN | N/A | In GCS | N/A | ✅ Works |
| **After Step 1** | Cached at CDN | N/A | In GCS | **In GCS** | ✅ Works |
| **After Step 2** | Cached at CDN | In GCS (origin) | In GCS | In GCS | ✅ Works |
| **After Step 3** | **Purged** | Cached at CDN | In GCS | In GCS | ✅ Works |
| **After Step 4** | Purged | Cached at CDN | **Deleted** | In GCS | ✅ Works |

**Key Insight**: Old bundles remain available until all CDN edges serve the new `index.html`. There is no window where a user receives a 404 error.

## Alternative Approaches (and Why They Don't Work)

### Approach 1: Single rsync -d + Async Invalidation

``````bash
gsutil rsync -r -d dist/ "gs://$BUCKET/"
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/*" --async
``````

**Problem**: Async invalidation means old `index.html` may still be cached after old bundles are deleted.

### Approach 2: Invalidate First, Then Upload

``````bash
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/*"
gsutil rsync -r -d dist/ "gs://$BUCKET/"
``````

**Problem**: Invalidation is asynchronous and takes time to propagate. Uploading immediately after doesn't guarantee all edges are purged.

### Approach 3: Use gsutil -h to Bypass Cache

``````bash
gsutil -h "Cache-Control:no-cache" rsync -r -d dist/ "gs://$BUCKET/"
``````

**Problem**: Hashed assets should have long cache for performance. No-cache on everything defeats the purpose of content hashing.

## Implementation in GitHub Actions

The zero-downtime pattern is implemented in:
- `.github/workflows/demo-deploy.yml` (Demo app)
- `.github/workflows/frontend-example-deploy.yml` (Example frontend)

Both workflows use the same 4-step sequence in the "Deploy to GCS" step.

## Performance Considerations

### Targeted Invalidation

Using targeted paths (`/index.html` and `/`) instead of wildcard (`/*`) invalidates only the entry point:

``````bash
# Fast (only 2 objects invalidated)
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/index.html"
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/"

# Slow (invalidates all cached objects)
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/*"
``````

**Why**: Hashed assets have long cache headers and never change (immutable). Only `index.html` needs to be invalidated.

### Synchronous Invalidation

The deployment waits for invalidation to complete before deleting old assets:

``````bash
# Synchronous (blocks until complete)
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/index.html"

# Asynchronous (returns immediately, invalidation happens in background)
gcloud compute url-maps invalidate-cdn-cache URLMAP --path "/*" --async
``````

**Trade-off**: Synchronous invalidation adds 5-10 seconds to deployment time but ensures safety.

## Comparison with Other Platforms

### Netlify, Vercel, Cloudflare Pages

These platforms handle zero-downtime deployments automatically with atomic uploads:
1. Upload all new assets to staging area
2. Atomically swap staging → production
3. Garbage collect old assets after TTL

**Terreno's approach** replicates this pattern manually with GCS + CDN using the 4-step sequence.

### AWS S3 + CloudFront

Similar problem, similar solution:
1. Upload new assets without deletion
2. Upload new `index.html`
3. Invalidate CloudFront cache (`aws cloudfront create-invalidation`)
4. Delete old assets

## Related Documentation

- [Deploy to GCP](../how-to/deploy-to-gcp.md) — Step-by-step deployment guide
- [GCP Hosting Architecture](./gcp-hosting-architecture.md) — Overall architecture
- [Google Cloud CDN Documentation](https://cloud.google.com/cdn/docs) — Official CDN docs
