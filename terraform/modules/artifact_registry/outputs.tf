output "repository_id" {
  value       = google_artifact_registry_repository.this.repository_id
  description = "Repository ID."
}

output "name" {
  value       = google_artifact_registry_repository.this.name
  description = "Fully qualified resource name."
}

output "docker_repo_url" {
  value       = "${google_artifact_registry_repository.this.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.this.repository_id}"
  description = "Hostname/path prefix to use when tagging Docker images."
}
