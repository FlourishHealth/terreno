variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "Region the repo lives in (matches the Cloud Run service region for fast pulls)."
  type        = string
}

variable "repository_id" {
  description = "Repository ID. Conventionally matches the Cloud Run service name."
  type        = string
}

variable "description" {
  description = "Human-readable description for the repo."
  type        = string
  default     = ""
}

variable "writer_members" {
  description = "Map of stable_key => IAM member for artifactregistry.writer. The key must be statically known at plan time (used as the for_each instance key); the value can be computed. Example: { gh-deployer = serviceAccount:foo@bar.iam.gserviceaccount.com }."
  type        = map(string)
  default     = {}
}

variable "reader_members" {
  description = "Map of stable_key => IAM member for artifactregistry.reader. See writer_members for key rules."
  type        = map(string)
  default     = {}
}

variable "keep_recent_versions" {
  description = "Cleanup policy: keep this many recent tagged versions per package. 0 disables the policy."
  type        = number
  default     = 30
}
