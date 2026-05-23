# Terreno Infrastructure (Terraform + Infra Manager)

This directory holds the Terraform configuration for Terreno's GCP infrastructure.
It is applied by **[Google Cloud Infrastructure Manager](https://cloud.google.com/infrastructure-manager/docs/overview)** via the unified `.github/workflows/cd.yml` workflow. That workflow also handles backend + MCP Cloud Run deployments, with `needs:` dependencies that guarantee terraform changes apply before any service deploy that might reference them (e.g. adding a new Secret Manager mount).

## What's managed

- Project APIs (Cloud Run, Artifact Registry, IAM, Infra Manager, etc.)
- GCS state bucket
- **Workload Identity Federation** — one pool/provider plus two impersonable service accounts:
  - `terraform-admin` — used by `cd.yml`'s terraform-* jobs (project-admin scope)
  - `gh-deployer` — used by `cd.yml`'s backend-deploy-* and mcp-deploy jobs with the narrow set of roles needed to push images and roll Cloud Run
- Artifact Registry repos for each Cloud Run service
- Cloud Run services (`terreno-backend-example`, `terreno-backend-example-tasks`, `terreno-mcp`) — **structural definition only** (resources, scaling, IAM, labels). Image and env vars are still set by the CD workflows on every deploy; Terraform's `lifecycle.ignore_changes` keeps it out of the way.
- Secret Manager containers for the backend's sensitive env vars: `terreno-backend-example-mongodb-uri`, `terreno-backend-example-langfuse-secret-key`, `terreno-backend-example-langfuse-public-key`. Values are seeded out-of-band; the backend and tasks deploy workflows mount them via `secrets:` so plaintext never traverses GitHub Actions runners.

The pre-existing `EXAMPLE_*` Secret Manager secrets (`EXAMPLE_MONGO_CONNECTION`, `EXAMPLE_TOKEN_SECRET`, `EXAMPLE_REFRESH_TOKEN_SECRET`) feeding `MONGO_URI`/`TOKEN_SECRET`/`REFRESH_TOKEN_SECRET` are not yet Terraform-managed but already use proper SM mounts. They can be imported in a follow-up. The MCP server's `SENTRY_DSN` is also still inline-from-GH-secret and could be migrated.

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
    secret/                     # Secret Manager secret container (kept for future use)
    github_oidc/                # WIF pool/provider + multi-SA support
```

The whole `terraform/` directory is the Infra Manager source. The workflow runs `--local-source=terraform`.

## One-time bootstrap

```bash
PROJECT_ID=flourish-terreno
STATE_BUCKET=flourish-terreno-tfstate-prod
LOCATION=us-central1                         # Infra Manager region

# 1. Enable APIs needed before Terraform can run. Terraform manages most of
#    these via the project_bootstrap module, but plan/apply itself needs the
#    cloud build, config, IAM, service usage, and storage APIs available
#    first.
gcloud services enable \
  cloudbuild.googleapis.com \
  cloudresourcemanager.googleapis.com \
  config.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  serviceusage.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"

# Look up the project number (used by terraform.tfvars):
gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)"

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
| `GCP_TF_ADMIN_SA_PROD` | output `terraform_admin_sa_email` | `cd.yml` (terraform jobs) |
| `GCP_CD_DEPLOYER_SA_PROD` | output `gh_deployer_sa_email` | `cd.yml` (deploy jobs) |
| `GCP_INFRA_MANAGER_LOCATION` | optional, defaults to `us-central1` | `cd.yml` |

Fetch the outputs after the first apply:

```bash
gcloud infra-manager deployments describe terreno-prod \
  --project=flourish-terreno --location=us-central1 \
  --format="value(latestRevision)"
# Then describe the returned revision to read its outputs:
gcloud infra-manager revisions describe <REVISION> --format=json | jq '.terraformBlueprint'
```

Once those repo variables are set, you can **delete the `GCP_SA_KEY` secret** from GitHub — every workflow now uses WIF.

## Importing existing resources

The first `terraform plan` will want to **create** resources that already exist (live Cloud Run service, Artifact Registry repo, existing Workload Identity Pool). Import them before the first apply:

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

# Workload Identity Pool + provider (already exist in flourish-terreno)
terraform import 'module.github_oidc.google_iam_workload_identity_pool.this' \
  projects/flourish-terreno/locations/global/workloadIdentityPools/github-actions
terraform import 'module.github_oidc.google_iam_workload_identity_pool_provider.github' \
  projects/flourish-terreno/locations/global/workloadIdentityPools/github-actions/providers/github
```

After import, `terraform plan` should show only safe metadata updates on the imported resources (description, cleanup_policies, labels, attribute_mapping additions). Cloud Run env vars and image are excluded from the plan via `lifecycle.ignore_changes`.

The tasks service and Artifact Registry repo are new Terraform-owned resources. If they were created manually before Terraform applies this configuration, import them with the same patterns:

```bash
terraform import 'module.tasks_service.google_cloud_run_v2_service.this' \
  projects/flourish-terreno/locations/us-central1/services/terreno-backend-example-tasks
terraform import 'module.tasks_artifact_registry.google_artifact_registry_repository.this' \
  projects/flourish-terreno/locations/us-central1/repositories/terreno-backend-example-tasks
```

## Adding a third service account

The `local.service_accounts` map in `main.tf` is the single source of truth. Add a new entry with its role set; Terraform will create the SA, bind project IAM, and grant `workloadIdentityUser` for every `github_repos` entry. Then read the new email out of `module.github_oidc.service_account_emails["<name>"]`.

## Adopting a new Secret Manager secret

The recommended two-PR flow (avoids a broken first deploy):

**PR 1 — infrastructure only:**

1. Add a `module "..." { source = "./modules/secret" ... }` block to `main.tf` (the module is already shipped). Grant accessor IAM to the relevant runtime SA.
2. Commit, merge. `cd.yml`'s `terraform-apply` job creates the empty SM container. Backend/MCP deploys skip (no code changes).
3. Seed the value: `echo -n 'value' | gcloud secrets versions add <secret-id> --project=flourish-terreno --data-file=-`.

**PR 2 — wire it up:**

4. Add the `KEY=<secret-id>:latest` line to the workflow's `secrets:` block in `cd.yml`. Remove the old `KEY=${{ secrets.X }}` line from `env_vars:` if migrating.
5. Commit, merge. `cd.yml`'s deploy job rolls a new Cloud Run revision that mounts the (already-populated) secret.

**Why two PRs?** The merged `cd.yml` guarantees terraform-apply finishes before any deploy, but it can't seed values — `gcloud secrets versions add` is a manual step. Doing it in one PR means the first deploy mounts an empty secret and Cloud Run rejects the revision.

For rotating a value of an already-set-up secret, no PR needed — just `gcloud secrets versions add`. Cloud Run re-reads `:latest` on every cold start.

## Local validation

```bash
cd terraform
terraform init
terraform fmt -check -recursive
terraform validate
```

Don't `terraform apply` locally — Infra Manager is the source of truth for who can apply.
