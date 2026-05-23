variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "project_number" {
  description = "GCP project number (the numeric ID, not the project_id slug). Used to construct the Cloud Run default runtime service account email (<project_number>-compute@developer.gserviceaccount.com). Required as a variable rather than a data source so a fresh project doesn't need cloudresourcemanager.googleapis.com enabled before the first plan. Find it with: gcloud projects describe <project_id> --format='value(projectNumber)'."
  type        = string
}

variable "environment" {
  description = "Environment label applied to all resources."
  type        = string
  default     = "prod"
}

variable "state_bucket_name" {
  description = "GCS bucket name used as Terraform state by Infrastructure Manager. Globally unique."
  type        = string
}

variable "github_owner" {
  description = "GitHub org/user that owns the source repos (used for WIF attribute condition)."
  type        = string
}

variable "github_repos" {
  description = "Set of '<owner>/<repo>' allowed to impersonate the deployer SAs."
  type        = set(string)
}

variable "backend_region" {
  description = "Region for the example backend Cloud Run service."
  type        = string
  default     = "us-central1"
}

variable "mcp_region" {
  description = "Region for the MCP server Cloud Run service."
  type        = string
  default     = "us-east1"
}

variable "backend_service_name" {
  description = "Cloud Run service name for the example backend."
  type        = string
}

variable "mcp_service_name" {
  description = "Cloud Run service name for the MCP server."
  type        = string
}

variable "placeholder_image" {
  description = "Placeholder image used only on initial service creation. The CD workflow overwrites this on every deploy."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "backend_min_instances" {
  description = "Min instances for the example backend."
  type        = number
  default     = 0
}

variable "backend_max_instances" {
  description = "Max instances for the example backend."
  type        = number
  default     = 10
}

variable "mcp_min_instances" {
  description = "Min instances for the MCP server."
  type        = number
  default     = 0
}

variable "mcp_max_instances" {
  description = "Max instances for the MCP server."
  type        = number
  default     = 10
}
