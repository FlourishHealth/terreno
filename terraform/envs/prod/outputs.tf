output "workload_identity_provider" {
  value       = module.env.workload_identity_provider
  description = "Pass to google-github-actions/auth as workload_identity_provider."
}

output "deployer_service_account_email" {
  value       = module.env.deployer_service_account_email
  description = "Pass to google-github-actions/auth as service_account."
}

output "backend_url" {
  value       = module.env.backend_url
  description = "Default URL of the example backend Cloud Run service."
}

output "mcp_url" {
  value       = module.env.mcp_url
  description = "Default URL of the MCP Cloud Run service."
}

output "backend_image_repo" {
  value       = module.env.backend_image_repo
  description = "Docker image prefix for the example backend."
}

output "mcp_image_repo" {
  value       = module.env.mcp_image_repo
  description = "Docker image prefix for the MCP server."
}
