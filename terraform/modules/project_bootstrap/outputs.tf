output "state_bucket_name" {
  value       = google_storage_bucket.tf_state.name
  description = "Name of the Infra Manager state bucket."
}

output "enabled_services" {
  value       = [for s in google_project_service.this : s.service]
  description = "List of enabled GCP services."
}
