output "workload_identity_provider" {
  value       = module.github_oidc.workload_identity_provider
  description = "Pass to google-github-actions/auth as workload_identity_provider. Shared by both service accounts."
}

output "terraform_admin_sa_email" {
  value       = module.github_oidc.service_account_emails["terraform-admin"]
  description = "Service account for terraform-apply.yml (project-admin scope). Repo var: GCP_TF_ADMIN_SA_PROD."
}

output "gh_deployer_sa_email" {
  value       = module.github_oidc.service_account_emails["gh-deployer"]
  description = "Service account for the CD workflows (deploy-example-gcp, mcp-server-deploy). Repo var: GCP_CD_DEPLOYER_SA_PROD."
}

output "backend_url" {
  value       = module.backend_service.uri
  description = "Default URL of the example backend Cloud Run service."
}

output "tasks_url" {
  value       = module.tasks_service.uri
  description = "Default URL of the example backend tasks Cloud Run service."
}

output "mcp_url" {
  value       = module.mcp_service.uri
  description = "Default URL of the MCP Cloud Run service."
}

output "backend_image_repo" {
  value       = module.backend_artifact_registry.docker_repo_url
  description = "Docker image prefix for the example backend."
}

output "tasks_image_repo" {
  value       = module.tasks_artifact_registry.docker_repo_url
  description = "Docker image prefix for the example backend tasks worker."
}

output "mcp_image_repo" {
  value       = module.mcp_artifact_registry.docker_repo_url
  description = "Docker image prefix for the MCP server."
}
