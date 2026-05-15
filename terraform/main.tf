locals {
  common_labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  # Two impersonable service accounts:
  #
  #   terraform-admin: Used by Infra Manager + the terraform-apply workflow.
  #     Needs admin-level scope because Terraform creates IAM bindings, WIF
  #     pools, secrets, buckets, and enables APIs.
  #
  #   gh-deployer:     Used by the CD workflows (deploy-example-gcp,
  #     mcp-server-deploy). Narrow scope: push images, roll Cloud Run, and
  #     read secrets so env vars sourced from Secret Manager work.
  service_accounts = {
    terraform-admin = {
      display_name = "Terraform admin"
      description  = "Impersonated by Infra Manager to apply terraform/. Project-admin scope."
      roles = [
        "roles/artifactregistry.admin",
        "roles/config.admin",
        "roles/iam.serviceAccountAdmin",
        # actAs is needed to update Cloud Run services whose runtime SA is
        # the Compute Engine default — serviceAccountAdmin doesn't grant it.
        "roles/iam.serviceAccountUser",
        "roles/iam.workloadIdentityPoolAdmin",
        "roles/resourcemanager.projectIamAdmin",
        "roles/run.admin",
        "roles/secretmanager.admin",
        "roles/serviceusage.serviceUsageAdmin",
        "roles/storage.admin",
      ]
    }
    gh-deployer = {
      display_name = "GitHub Actions CD deployer"
      description  = "Impersonated by the application deploy workflows. Push images + roll Cloud Run + read secrets."
      roles = [
        "roles/artifactregistry.writer",
        "roles/iam.serviceAccountUser",
        "roles/run.admin",
        "roles/secretmanager.secretAccessor",
      ]
    }
  }
}

module "bootstrap" {
  source = "./modules/project_bootstrap"

  project_id        = var.project_id
  state_bucket_name = var.state_bucket_name
}

module "github_oidc" {
  source = "./modules/github_oidc"

  project_id       = var.project_id
  github_owner     = var.github_owner
  github_repos     = var.github_repos
  service_accounts = local.service_accounts

  depends_on = [module.bootstrap]
}

# ---------------------------------------------------------------------------
# Example backend
#
# Cloud Run service env vars + image are managed by the CD workflow
# (deploy-example-gcp.yml), which sources values from GitHub Actions secrets.
# Terraform owns the structural definition: resources, scaling, IAM, labels.
# ---------------------------------------------------------------------------

module "backend_artifact_registry" {
  source = "./modules/artifact_registry"

  project_id    = var.project_id
  region        = var.backend_region
  repository_id = var.backend_service_name
  description   = "Container images for ${var.backend_service_name}."

  writer_members = {
    gh-deployer = "serviceAccount:${module.github_oidc.service_account_emails["gh-deployer"]}"
  }

  depends_on = [module.bootstrap]
}

module "backend_secret_mongodb_uri" {
  source = "./modules/secret"

  project_id = var.project_id
  secret_id  = "${var.backend_service_name}-mongodb-uri"
  labels     = local.common_labels

  accessor_members = {
    cloud-run-runtime = "serviceAccount:${var.project_number}-compute@developer.gserviceaccount.com"
  }

  depends_on = [module.bootstrap]
}

module "backend_secret_langfuse_secret_key" {
  source = "./modules/secret"

  project_id = var.project_id
  secret_id  = "${var.backend_service_name}-langfuse-secret-key"
  labels     = local.common_labels

  accessor_members = {
    cloud-run-runtime = "serviceAccount:${var.project_number}-compute@developer.gserviceaccount.com"
  }

  depends_on = [module.bootstrap]
}

module "backend_secret_langfuse_public_key" {
  source = "./modules/secret"

  project_id = var.project_id
  secret_id  = "${var.backend_service_name}-langfuse-public-key"
  labels     = local.common_labels

  accessor_members = {
    cloud-run-runtime = "serviceAccount:${var.project_number}-compute@developer.gserviceaccount.com"
  }

  depends_on = [module.bootstrap]
}

module "backend_service" {
  source = "./modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.backend_region
  service_name          = var.backend_service_name
  image                 = var.placeholder_image
  port                  = 3000
  memory                = "512Mi"
  cpu                   = "1"
  min_instances         = var.backend_min_instances
  max_instances         = var.backend_max_instances
  concurrency           = 80
  timeout_seconds       = 300
  allow_unauthenticated = true
  labels                = local.common_labels

  depends_on = [
    module.backend_artifact_registry,
    module.backend_secret_mongodb_uri,
    module.backend_secret_langfuse_secret_key,
    module.backend_secret_langfuse_public_key,
  ]
}

# ---------------------------------------------------------------------------
# MCP server (same shape as the backend)
# ---------------------------------------------------------------------------

module "mcp_artifact_registry" {
  source = "./modules/artifact_registry"

  project_id    = var.project_id
  region        = var.mcp_region
  repository_id = var.mcp_service_name
  description   = "Container images for ${var.mcp_service_name}."

  writer_members = {
    gh-deployer = "serviceAccount:${module.github_oidc.service_account_emails["gh-deployer"]}"
  }

  depends_on = [module.bootstrap]
}

module "mcp_service" {
  source = "./modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.mcp_region
  service_name          = var.mcp_service_name
  image                 = var.placeholder_image
  port                  = 8080
  memory                = "512Mi"
  cpu                   = "1"
  min_instances         = var.mcp_min_instances
  max_instances         = var.mcp_max_instances
  concurrency           = 80
  timeout_seconds       = 300
  allow_unauthenticated = true
  labels                = local.common_labels

  depends_on = [module.mcp_artifact_registry]
}
