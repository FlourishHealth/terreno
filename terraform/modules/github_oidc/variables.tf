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

variable "github_owner" {
  description = "GitHub org/user that owns the repo. Used in OIDC attribute condition."
  type        = string
}

variable "github_repos" {
  description = "Set of '<owner>/<repo>' strings allowed to impersonate any of the service accounts via this pool."
  type        = set(string)
}

variable "service_accounts" {
  description = "Service accounts to create. Each entry gets its own SA with the given project-level roles, plus iam.workloadIdentityUser bindings for every github_repos entry. Use this to split powers (e.g., one admin SA for Terraform, one narrow SA for CD pipelines)."
  type = map(object({
    display_name = optional(string)
    description  = optional(string)
    roles        = set(string)
  }))
}
