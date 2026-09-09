output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.circleci.name
  description = "CircleCI context value for GCP_WIF_PROVIDER_PROD."
}
