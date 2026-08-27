variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "circleci_org_id" {
  description = "CircleCI organization UUID used as issuer and audience."
  type        = string
}

variable "circleci_project_id" {
  description = "CircleCI project UUID allowed to impersonate deployment service accounts."
  type        = string
}

variable "circleci_gcp_context_id" {
  description = "UUID of the CircleCI context that GCP jobs must attach (terreno-gcp). Empty skips the context claim check."
  type        = string
  default     = ""
}

variable "service_account_names" {
  description = "Fully qualified service account resource names to make impersonable from CircleCI."
  type        = map(string)
}
