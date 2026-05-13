module "env" {
  source = "../../shared/env"

  project_id        = var.project_id
  environment       = var.environment
  state_bucket_name = var.state_bucket_name

  github_owner = var.github_owner
  github_repos = var.github_repos

  backend_region        = var.backend_region
  mcp_region            = var.mcp_region
  backend_service_name  = var.backend_service_name
  mcp_service_name      = var.mcp_service_name
  placeholder_image     = var.placeholder_image
  backend_min_instances = var.backend_min_instances
  backend_max_instances = var.backend_max_instances
  mcp_min_instances     = var.mcp_min_instances
  mcp_max_instances     = var.mcp_max_instances
}
