terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Infrastructure Manager provides the backend automatically when deploying
  # via `gcloud infra-manager deployments apply`. For local development, you
  # can configure a GCS backend:
  #
  # backend "gcs" {
  #   bucket = "terreno-terraform-state"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  service_name = "${var.app_name}-api"
  repo_name    = var.app_name
  image_url    = var.image_tag != "" ? "${var.region}-docker.pkg.dev/${var.project_id}/${local.repo_name}/${local.repo_name}:${var.image_tag}" : "us-docker.pkg.dev/cloudrun/container/hello"

  ingress_enum_map = {
    all                               = "INGRESS_TRAFFIC_ALL"
    internal                          = "INGRESS_TRAFFIC_INTERNAL_ONLY"
    internal-and-cloud-load-balancing = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  }

  # Merge default env vars with user-provided ones
  default_env_vars = {
    NODE_ENV = "production"
    TZ       = "America/New_York"
  }
  all_env_vars = merge(local.default_env_vars, var.env_vars)
}

# -------------------------------------------------------------------
# Enable required APIs
# -------------------------------------------------------------------
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "config.googleapis.com",
  ])

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# -------------------------------------------------------------------
# Artifact Registry — Docker repository for container images
# -------------------------------------------------------------------
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = local.repo_name
  format        = "DOCKER"
  description   = "Docker images for ${var.app_name}"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 25
    }
  }

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# -------------------------------------------------------------------
# Service Account for Cloud Run
# -------------------------------------------------------------------
resource "google_service_account" "cloudrun" {
  account_id   = "${var.app_name}-run"
  display_name = "Cloud Run service account for ${var.app_name}"
}

# Grant the Cloud Run SA access to pull images from Artifact Registry
resource "google_artifact_registry_repository_iam_member" "cloudrun_reader" {
  location   = google_artifact_registry_repository.docker.location
  repository = google_artifact_registry_repository.docker.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Grant the Cloud Run SA access to read only the specific secrets it needs
resource "google_secret_manager_secret_iam_member" "cloudrun_secret_access" {
  for_each  = var.deploy_service ? var.secrets : {}
  secret_id = each.value
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}

# -------------------------------------------------------------------
# Secret Manager — reference existing secrets (created outside TF)
# -------------------------------------------------------------------
# Secrets are created manually or by a bootstrap script. Terraform only
# references them so Cloud Run can mount them as env vars.
#
# Create secrets with:
#   gcloud secrets create SECRET_NAME --project=PROJECT_ID --replication-policy=automatic
#   echo -n "value" | gcloud secrets versions add SECRET_NAME --project=PROJECT_ID --data-file=-
data "google_secret_manager_secret" "secrets" {
  for_each  = var.deploy_service ? var.secrets : {}
  secret_id = each.value
  project   = var.project_id
}

# -------------------------------------------------------------------
# Cloud Run Service — API
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service" "api" {
  count    = var.deploy_service ? 1 : 0
  name     = local.service_name
  location = var.region
  ingress  = lookup(local.ingress_enum_map, var.ingress, "INGRESS_TRAFFIC_ALL")

  lifecycle {
    precondition {
      condition     = var.image_tag != ""
      error_message = "image_tag must be set when deploy_service is true."
    }
    # Image is updated by CI via gcloud run deploy, not Terraform
    ignore_changes = [template[0].containers[0].image]
  }

  template {
    service_account = google_service_account.cloudrun.email
    timeout         = "${var.api_timeout}s"

    max_instance_request_concurrency = var.api_concurrency

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    vpc_access {
      network_interfaces {
        network    = var.vpc_network
        subnetwork = var.vpc_subnet
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = local.image_url

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.api_cpu
          memory = var.api_memory
        }
        startup_cpu_boost = true
      }

      # Non-secret environment variables
      dynamic "env" {
        for_each = local.all_env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret environment variables from Secret Manager
      dynamic "env" {
        for_each = var.deploy_service ? var.secrets : {}
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.secrets[env.key].secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 2
        failure_threshold = 30
        timeout_seconds   = 1
      }
    }
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_artifact_registry_repository.docker,
  ]
}

# -------------------------------------------------------------------
# IAM — Allow unauthenticated access (public API)
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.deploy_service ? 1 : 0
  name     = google_cloud_run_v2_service.api[0].name
  location = google_cloud_run_v2_service.api[0].location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -------------------------------------------------------------------
# Custom Domain Mapping (optional)
# -------------------------------------------------------------------
resource "google_cloud_run_domain_mapping" "api" {
  count    = var.deploy_service && var.domain != "" ? 1 : 0
  name     = var.domain
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.api[0].name
  }
}
