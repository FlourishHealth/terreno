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
  description = "IAM members granted artifactregistry.writer (push). Format: 'serviceAccount:foo@...' or 'group:bar@...'."
  type        = list(string)
  default     = []
}

variable "reader_members" {
  description = "IAM members granted artifactregistry.reader (pull). Cloud Run's runtime SA reads images, but it's already an implicit member when the repo lives in the same project."
  type        = list(string)
  default     = []
}

variable "keep_recent_versions" {
  description = "Cleanup policy: keep this many recent tagged versions per package. 0 disables the policy."
  type        = number
  default     = 30
}
