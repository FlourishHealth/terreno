# Terreno Infrastructure (Terraform + Infra Manager)

This directory holds the Terraform configuration for Terreno's GCP infrastructure.
It is applied by **[Google Cloud Infrastructure Manager](https://cloud.google.com/infrastructure-manager/docs/overview)** via a GitHub Actions workflow (`.github/workflows/terraform-apply.yml`).

## What's managed

- Project APIs (Cloud Run, Artifact Registry, Secret Manager, Infra Manager, IAM, etc.)
- GCS state bucket
- **Workload Identity Federation** pool + provider + deployer service account
  (replaces the legacy `GCP_SA_KEY` secret)
- Artifact Registry repos for each Cloud Run service
- Cloud Run services (`terreno-backend-example`, `terreno-mcp`) with env vars and
  Secret Manager-sourced env vars
- Secret Manager **secret containers** (values seeded out-of-band — see
  [Seeding secrets](#seeding-secrets))

Cloud Run **image rollouts** are still driven by the existing deploy workflows
(`deploy-example-gcp.yml`, `mcp-server-deploy.yml`). Terraform owns the service
definition; the workflow owns the image tag. `lifecycle.ignore_changes` on
`template[0].containers[0].image` keeps them out of each other's way.

## Layout

```
terraform/
  modules/                      # Reusable building blocks
    project_bootstrap/          # APIs + state bucket
    artifact_registry/          # Docker repo + IAM
    cloud_run_service/          # v2 Cloud Run service + invoker IAM
    secret/                     # Secret Manager secret container
    github_oidc/                # WIF pool/provider/SA
  shared/
    env/                        # Composition of the above
  envs/
    prod/                       # Thin wrapper + terraform.tfvars
```

The `shared/env` and `envs/prod` split exists so adding a second environment
later is purely additive — copy `envs/prod` to `envs/<new-env>` and update
`terraform.tfvars`.

## One-time bootstrap

The Infra Manager deployment SA needs a place to live and the state bucket
needs to exist *before* Terraform can run. Bootstrap is a manual step:

```bash
PROJECT_ID=flourish-terreno
STATE_BUCKET=flourish-terreno-tfstate-prod
LOCATION=us-central1                         # Infra Manager region

# 1. Enable required APIs on the project.
gcloud services enable \
  cloudbuild.googleapis.com \
  config.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  serviceusage.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"

# 2. Create the state bucket (Terraform will adopt it on first apply).
gsutil mb -p "$PROJECT_ID" -l US -b on "gs://$STATE_BUCKET"

# 3. Create a bootstrap service account that Infra Manager can use to apply
#    the initial deployment (this is the same SA Terraform will then manage).
gcloud iam service-accounts create infra-manager-bootstrap \
  --project="$PROJECT_ID" \
  --display-name="Infra Manager bootstrap"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:infra-manager-bootstrap@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/owner"

# 4. Create the Infra Manager deployment.
gcloud infra-manager deployments apply terreno-prod \
  --project="$PROJECT_ID" \
  --location="$LOCATION" \
  --service-account="infra-manager-bootstrap@${PROJECT_ID}.iam.gserviceaccount.com" \
  --local-source="envs/prod"
```

After step 4 succeeds, the WIF provider, deployer SA, and all other resources
exist. From here on, applies happen via GitHub Actions and the bootstrap SA
is unused.

## GitHub Actions setup

Set these as **repository variables** (Settings → Secrets and variables →
Actions → Variables — not secrets, the WIF provider name and SA email aren't
sensitive):

| Variable | Value |
|----------|-------|
| `GCP_TF_PROJECT_ID_PROD` | `flourish-terreno` |
| `GCP_WIF_PROVIDER_PROD` | output `workload_identity_provider` from the first apply |
| `GCP_TF_DEPLOYER_SA_PROD` | output `deployer_service_account_email` from the first apply |
| `GCP_INFRA_MANAGER_LOCATION` | optional, defaults to `us-central1` |

Fetch the outputs after the first apply:

```bash
gcloud infra-manager deployments describe terreno-prod \
  --project=flourish-terreno --location=us-central1 \
  --format="value(latestRevision)"
# Then grab the outputs from the returned revision name:
gcloud infra-manager revisions describe <REVISION> \
  --format="json" | jq '.terraformBlueprint.gcsSource'   # or similar
```

Once those repo variables are set, you can **delete the `GCP_SA_KEY` secret**
from GitHub — the deploy workflows now use WIF.

## Seeding secrets

Terraform creates Secret Manager **containers** but never holds the values.
Seed each one with `gcloud`:

```bash
PROJECT_ID=flourish-terreno

# Backend example secrets
echo -n 'mongodb+srv://...' | \
  gcloud secrets versions add terreno-backend-example-mongo-uri \
  --project="$PROJECT_ID" --data-file=-

echo -n 'sk-lf-...' | \
  gcloud secrets versions add terreno-backend-example-langfuse-secret-key \
  --project="$PROJECT_ID" --data-file=-

echo -n 'pk-lf-...' | \
  gcloud secrets versions add terreno-backend-example-langfuse-public-key \
  --project="$PROJECT_ID" --data-file=-

# MCP server secret
echo -n 'https://...@sentry.io/...' | \
  gcloud secrets versions add terreno-mcp-sentry-dsn \
  --project="$PROJECT_ID" --data-file=-
```

Rotation = `gcloud secrets versions add` again. Cloud Run reads `:latest`
on every cold start.

## Importing existing resources

The first `terraform plan` will want to **create** resources that already
exist (the live Cloud Run service, Artifact Registry repo, etc.). Import them
before the first apply:

```bash
cd envs/prod
terraform init

# Cloud Run services
terraform import 'module.env.module.backend_service.google_cloud_run_v2_service.this' \
  projects/flourish-terreno/locations/us-central1/services/terreno-backend-example
terraform import 'module.env.module.mcp_service.google_cloud_run_v2_service.this' \
  projects/flourish-terreno/locations/us-east1/services/terreno-mcp

# Artifact Registry repos
terraform import 'module.env.module.backend_artifact_registry.google_artifact_registry_repository.this' \
  projects/flourish-terreno/locations/us-central1/repositories/terreno-backend-example
terraform import 'module.env.module.mcp_artifact_registry.google_artifact_registry_repository.this' \
  projects/flourish-terreno/locations/us-east1/repositories/terreno-mcp
```

Then `terraform plan` should show no diff (or just additions for the new
secret containers / WIF resources). If the plan wants to change Cloud Run env
vars, that's expected — Terraform will rewrite the service to reference
Secret Manager. Re-create the secret values *before* the first apply so the
service doesn't go down.

## Adding a new secret

1. Add a `module "..." { source = "../../modules/secret" ... }` block to
   `shared/env/main.tf`.
2. Add it to `secret_env` on the relevant Cloud Run service.
3. Add the same `KEY=secret-id:latest` entry to the `secrets:` block of the
   deploy workflow (so workflow rollouts keep the mount in sync).
4. Commit, merge — Infra Manager will create the empty container.
5. `gcloud secrets versions add` to seed the value.

## Local validation

```bash
cd envs/prod
terraform init
terraform fmt -recursive ../..
terraform validate
```

Don't `terraform apply` locally — Infra Manager is the source of truth for
who can apply.
