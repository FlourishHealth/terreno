output "api_url" {
  description = "Cloud Run service URL"
  value       = var.deploy_service ? google_cloud_run_v2_service.api[0].uri : "(service not yet deployed)"
}

output "service_name" {
  description = "Cloud Run service name"
  value       = var.deploy_service ? google_cloud_run_v2_service.api[0].name : "(service not yet deployed)"
}

output "artifact_registry_url" {
  description = "Artifact Registry repository URL for docker push"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "service_account_email" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloudrun.email
}
