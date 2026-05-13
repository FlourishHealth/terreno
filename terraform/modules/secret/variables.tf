variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "secret_id" {
  description = "Secret Manager secret ID (the human-readable name)."
  type        = string
}

variable "replication_locations" {
  description = "If non-empty, use user-managed replication restricted to these regions. Empty list = automatic global replication."
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Labels applied to the secret."
  type        = map(string)
  default     = {}
}

variable "accessor_members" {
  description = "IAM members granted secretmanager.secretAccessor."
  type        = list(string)
  default     = []
}
