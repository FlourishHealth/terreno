output "name" {
  value       = google_cloud_run_v2_service.this.name
  description = "Service name."
}

output "uri" {
  value       = google_cloud_run_v2_service.this.uri
  description = "Default https URL of the service."
}

output "location" {
  value       = google_cloud_run_v2_service.this.location
  description = "Region."
}
