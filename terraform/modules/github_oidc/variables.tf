variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "pool_id" {
  description = "Workload Identity Pool ID. 4-32 chars, alphanum and hyphens."
  type        = string
  default     = "github-actions"
}

variable "provider_id" {
  description = "Workload Identity Pool Provider ID."
  type        = string
  default     = "github"
}

variable "service_account_id" {
  description = "Service account ID for the GitHub deployer."
  type        = string
  default     = "github-actions-deployer"
}

variable "github_owner" {
  description = "GitHub org/user that owns the repo. Used in OIDC attribute condition."
  type        = string
}

variable "github_repos" {
  description = "Set of '<owner>/<repo>' strings allowed to impersonate the deployer SA via this pool."
  type        = set(string)
}

variable "roles" {
  description = "IAM roles granted to the deployer SA at the project level."
  type        = set(string)
  default = [
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectViewer",
  ]
}
