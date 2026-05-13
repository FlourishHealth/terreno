output "workload_identity_provider" {
  value       = module.github_oidc.workload_identity_provider
  description = "Pass to google-github-actions/auth as workload_identity_provider."
}

output "deployer_service_account_email" {
  value       = module.github_oidc.service_account_email
  description = "Pass to google-github-actions/auth as service_account."
}

output "backend_url" {
  value       = module.backend_service.uri
  description = "Default URL of the example backend Cloud Run service."
}

output "mcp_url" {
  value       = module.mcp_service.uri
  description = "Default URL of the MCP Cloud Run service."
}

output "backend_image_repo" {
  value       = module.backend_artifact_registry.docker_repo_url
  description = "Docker image prefix for the example backend."
}

output "mcp_image_repo" {
  value       = module.mcp_artifact_registry.docker_repo_url
  description = "Docker image prefix for the MCP server."
}
