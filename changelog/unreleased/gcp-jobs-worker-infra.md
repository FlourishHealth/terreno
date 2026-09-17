---
category: Added
---

# GCP durable-jobs worker infrastructure

Infra Manager now owns the example Cloud Tasks queue `terreno-example-jobs`, the
private `terreno-backend-example-tasks` Cloud Run service, the
`terreno-backend-runtime` API identity (sole queue enqueuer / jobs-invoker
`actAs`), and the `terreno-jobs-invoker` OIDC callback identity. CD deploys
matching PR tags for the API and tasks services. The example API still uses
`MongoJobRunner` until a follow-up selects `JOBS_RUNNER=gcp-cloud-tasks`. The
example image compiles `@terreno/jobs` before `@terreno/admin-backend`.
