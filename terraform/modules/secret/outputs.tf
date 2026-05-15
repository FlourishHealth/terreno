output "secret_id" {
  value       = google_secret_manager_secret.this.secret_id
  description = "Short secret ID (used by Cloud Run --set-secrets and gcloud)."
}

output "name" {
  value       = google_secret_manager_secret.this.name
  description = "Fully qualified resource name: projects/<num>/secrets/<id>."
}
