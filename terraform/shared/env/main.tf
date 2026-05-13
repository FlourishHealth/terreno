locals {
  common_labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

module "bootstrap" {
  source = "../../modules/project_bootstrap"

  project_id        = var.project_id
  state_bucket_name = var.state_bucket_name
}

module "github_oidc" {
  source = "../../modules/github_oidc"

  project_id   = var.project_id
  github_owner = var.github_owner
  github_repos = var.github_repos

  depends_on = [module.bootstrap]
}

# ---------------------------------------------------------------------------
# Example backend (Cloud Run + Artifact Registry + secrets)
# ---------------------------------------------------------------------------

module "backend_artifact_registry" {
  source = "../../modules/artifact_registry"

  project_id    = var.project_id
  region        = var.backend_region
  repository_id = var.backend_service_name
  description   = "Container images for ${var.backend_service_name} (${var.environment})."

  writer_members = [
    "serviceAccount:${module.github_oidc.service_account_email}",
  ]

  depends_on = [module.bootstrap]
}

module "backend_secret_mongo_uri" {
  source = "../../modules/secret"

  project_id = var.project_id
  secret_id  = "${var.backend_service_name}-mongo-uri"
  labels     = local.common_labels

  accessor_members = [
    "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com",
  ]

  depends_on = [module.bootstrap]
}

module "backend_secret_langfuse_secret_key" {
  source = "../../modules/secret"

  project_id = var.project_id
  secret_id  = "${var.backend_service_name}-langfuse-secret-key"
  labels     = local.common_labels

  accessor_members = [
    "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com",
  ]

  depends_on = [module.bootstrap]
}

module "backend_secret_langfuse_public_key" {
  source = "../../modules/secret"

  project_id = var.project_id
  secret_id  = "${var.backend_service_name}-langfuse-public-key"
  labels     = local.common_labels

  accessor_members = [
    "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com",
  ]

  depends_on = [module.bootstrap]
}

module "backend_service" {
  source = "../../modules/cloud_run_service"

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

  env = {
    NODE_ENV = "production"
  }

  secret_env = {
    MONGODB_URI         = module.backend_secret_mongo_uri.secret_id
    LANGFUSE_SECRET_KEY = module.backend_secret_langfuse_secret_key.secret_id
    LANGFUSE_PUBLIC_KEY = module.backend_secret_langfuse_public_key.secret_id
  }

  depends_on = [
    module.backend_artifact_registry,
    module.backend_secret_mongo_uri,
    module.backend_secret_langfuse_secret_key,
    module.backend_secret_langfuse_public_key,
  ]
}

# ---------------------------------------------------------------------------
# MCP server (Cloud Run + Artifact Registry + secrets)
# ---------------------------------------------------------------------------

module "mcp_artifact_registry" {
  source = "../../modules/artifact_registry"

  project_id    = var.project_id
  region        = var.mcp_region
  repository_id = var.mcp_service_name
  description   = "Container images for ${var.mcp_service_name} (${var.environment})."

  writer_members = [
    "serviceAccount:${module.github_oidc.service_account_email}",
  ]

  depends_on = [module.bootstrap]
}

module "mcp_secret_sentry_dsn" {
  source = "../../modules/secret"

  project_id = var.project_id
  secret_id  = "${var.mcp_service_name}-sentry-dsn"
  labels     = local.common_labels

  accessor_members = [
    "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com",
  ]

  depends_on = [module.bootstrap]
}

module "mcp_service" {
  source = "../../modules/cloud_run_service"

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

  secret_env = {
    SENTRY_DSN = module.mcp_secret_sentry_dsn.secret_id
  }

  depends_on = [
    module.mcp_artifact_registry,
    module.mcp_secret_sentry_dsn,
  ]
}

data "google_project" "this" {
  project_id = var.project_id
}
