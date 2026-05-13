# Terreno Infrastructure (Terraform + Infra Manager)

This directory holds the Terraform configuration for Terreno's GCP infrastructure.
It is applied by **[Google Cloud Infrastructure Manager](https://cloud.google.com/infrastructure-manager/docs/overview)** via a GitHub Actions workflow (`.github/workflows/terraform-apply.yml`).

## What's managed

- Project APIs (Cloud Run, Artifact Registry, Secret Manager, Infra Manager, IAM, etc.)
- GCS state bucket
- **Workload Identity Federation** — one pool/provider plus two impersonable service accounts:
  - `terraform-admin` — used by `terraform-apply.yml` (project-admin scope)
  - `gh-deployer` — used by the CD workflows (`deploy-example-gcp.yml`, `mcp-server-deploy.yml`) with the narrow set of roles needed to push images and roll Cloud Run
- Artifact Registry repos for each Cloud Run service
- Cloud Run services (`terreno-backend-example`, `terreno-mcp`) with env vars and Secret Manager-sourced env vars
- Secret Manager **secret containers** (values seeded out-of-band — see [Seeding secrets](#seeding-secrets))

Cloud Run **image rollouts** are still driven by the CD workflows. Terraform owns the service definition; the workflow owns the image tag. `lifecycle.ignore_changes` on `template[0].containers[0].image` keeps them out of each other's way.

## Layout

```
terraform/
  main.tf                       # Composition (modules wired together)
  variables.tf
  outputs.tf
  versions.tf
  terraform.tfvars              # Project-specific values
  modules/
    project_bootstrap/          # APIs + state bucket
    artifact_registry/          # Docker repo + IAM
    cloud_run_service/          # v2 Cloud Run service + invoker IAM
    secret/                     # Secret Manager secret container
    github_oidc/                # WIF pool/provider + multi-SA support
```

The whole `terraform/` directory is the Infra Manager source. The workflow runs `--local-source=terraform`.

## One-time bootstrap

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

# 3. Create a bootstrap service account that Infra Manager can use for the
#    initial apply. After the first apply, the workflow uses the
#    terraform-admin SA Terraform itself created.
gcloud iam service-accounts create infra-manager-bootstrap \
  --project="$PROJECT_ID" \
  --display-name="Infra Manager bootstrap"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:infra-manager-bootstrap@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/owner"

# 4. Create the Infra Manager deployment, pointing at the whole terraform/
#    directory.
gcloud infra-manager deployments apply terreno-prod \
  --project="$PROJECT_ID" \
  --location="$LOCATION" \
  --service-account="infra-manager-bootstrap@${PROJECT_ID}.iam.gserviceaccount.com" \
  --local-source="."
# (run from the terraform/ directory; or use --local-source="terraform" from repo root)
```

After step 4 succeeds, the WIF provider, both deployer SAs, and all other resources exist. From here on, applies happen via GitHub Actions impersonating `terraform-admin@`. The bootstrap SA can stay around for break-glass use or be deleted.

## GitHub Actions setup

Set these as **repository variables** (Settings → Secrets and variables → Actions → Variables — not secrets, none of these are sensitive):

| Variable | Value | Used by |
|----------|-------|---------|
| `GCP_TF_PROJECT_ID_PROD` | `flourish-terreno` | all workflows |
| `GCP_WIF_PROVIDER_PROD` | output `workload_identity_provider` | all workflows |
| `GCP_TF_ADMIN_SA_PROD` | output `terraform_admin_sa_email` | `terraform-apply.yml` |
| `GCP_CD_DEPLOYER_SA_PROD` | output `gh_deployer_sa_email` | `deploy-example-gcp.yml`, `mcp-server-deploy.yml` |
| `GCP_INFRA_MANAGER_LOCATION` | optional, defaults to `us-central1` | `terraform-apply.yml` |

Fetch the outputs after the first apply:

```bash
gcloud infra-manager deployments describe terreno-prod \
  --project=flourish-terreno --location=us-central1 \
  --format="value(latestRevision)"
# Then describe the returned revision to read its outputs:
gcloud infra-manager revisions describe <REVISION> --format=json | jq '.terraformBlueprint'
```

Once those repo variables are set, you can **delete the `GCP_SA_KEY` secret** from GitHub — every workflow now uses WIF.

## Seeding secrets

Terraform creates Secret Manager **containers** but never holds the values. Seed each one with `gcloud`:

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

Rotation = `gcloud secrets versions add` again. Cloud Run reads `:latest` on every cold start.

## Importing existing resources

The first `terraform plan` will want to **create** resources that already exist (live Cloud Run service, Artifact Registry repo, etc.). Import them before the first apply:

```bash
cd terraform
terraform init

# Cloud Run services
terraform import 'module.backend_service.google_cloud_run_v2_service.this' \
  projects/flourish-terreno/locations/us-central1/services/terreno-backend-example
terraform import 'module.mcp_service.google_cloud_run_v2_service.this' \
  projects/flourish-terreno/locations/us-east1/services/terreno-mcp

# Artifact Registry repos
terraform import 'module.backend_artifact_registry.google_artifact_registry_repository.this' \
  projects/flourish-terreno/locations/us-central1/repositories/terreno-backend-example
terraform import 'module.mcp_artifact_registry.google_artifact_registry_repository.this' \
  projects/flourish-terreno/locations/us-east1/repositories/terreno-mcp
```

Then `terraform plan` should show no diff (or just additions for the new secret containers / WIF resources). If the plan wants to change Cloud Run env vars, that's expected — Terraform will rewrite the service to reference Secret Manager. Seed the secret values **before** the first apply so the service doesn't go down.

## Adding a new secret

1. Add a `module "..." { source = "./modules/secret" ... }` block to `main.tf`.
2. Add it to `secret_env` on the relevant Cloud Run service module.
3. Add the same `KEY=secret-id:latest` entry to the `secrets:` block of the deploy workflow (so workflow rollouts keep the mount in sync).
4. Commit, merge — Infra Manager will create the empty container.
5. `gcloud secrets versions add` to seed the value.

## Adding a third service account

The `local.service_accounts` map in `main.tf` is the single source of truth. Add a new entry with its role set; Terraform will create the SA, bind project IAM, and grant `workloadIdentityUser` for every `github_repos` entry. Then read the new email out of `module.github_oidc.service_account_emails["<name>"]`.

## Local validation

```bash
cd terraform
terraform init
terraform fmt -check -recursive
terraform validate
```

Don't `terraform apply` locally — Infra Manager is the source of truth for who can apply.
