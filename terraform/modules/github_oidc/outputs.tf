output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Pass this to google-github-actions/auth as workload_identity_provider."
}

output "service_account_email" {
  value       = google_service_account.deployer.email
  description = "Pass this to google-github-actions/auth as service_account."
}

output "pool_name" {
  value       = google_iam_workload_identity_pool.this.name
  description = "Fully qualified pool name."
}
