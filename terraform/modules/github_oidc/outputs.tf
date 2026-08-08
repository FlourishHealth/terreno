output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Pass to google-github-actions/auth as workload_identity_provider. Shared by all service accounts."
}

output "pool_name" {
  value       = google_iam_workload_identity_pool.this.name
  description = "Fully qualified pool name."
}

output "service_account_emails" {
  value       = { for k, v in google_service_account.sa : k => v.email }
  description = "Map of {sa_name => email}. Each SA is impersonable via the pool by any github_repos entry."
}
