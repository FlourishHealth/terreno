variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "app_name" {
  description = "Application name prefix for all resources"
  type        = string
  default     = "terreno"
}

variable "image_tag" {
  description = "Docker image tag to deploy. Leave empty to use a placeholder for bootstrapping."
  type        = string
  default     = ""
}

variable "deploy_service" {
  description = "Set to true once the AR repo has a real image and required Secret Manager secrets already exist with values. When false, only creates supporting infrastructure (AR repo, service account, IAM) — secrets are not created or modified by Terraform."
  type        = bool
  default     = false
}

# Cloud Run configuration
variable "api_cpu" {
  description = "CPU allocation for the API service (e.g., '1000m', '2000m')"
  type        = string
  default     = "1000m"
}

variable "api_memory" {
  description = "Memory allocation for the API service (e.g., '512Mi', '1Gi', '2Gi')"
  type        = string
  default     = "1Gi"
}

variable "api_min_instances" {
  description = "Minimum number of API instances"
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Maximum number of API instances"
  type        = number
  default     = 10
}

variable "api_concurrency" {
  description = "Maximum concurrent requests per container"
  type        = number
  default     = 80
}

variable "api_timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

# Environment variables (non-secret)
variable "env_vars" {
  description = "Non-secret environment variables for the Cloud Run service"
  type        = map(string)
  default     = {}
}

# Secrets to mount from Secret Manager
variable "secrets" {
  description = "Map of env var name to Secret Manager secret name"
  type        = map(string)
  default     = {}
}

# Networking
variable "vpc_network" {
  description = "VPC network name for direct VPC egress"
  type        = string
  default     = "default"
}

variable "vpc_subnet" {
  description = "VPC subnet name for direct VPC egress"
  type        = string
  default     = "default"
}

variable "ingress" {
  description = "Ingress setting for Cloud Run (all, internal, internal-and-cloud-load-balancing)"
  type        = string
  default     = "all"
  validation {
    condition     = contains(["all", "internal", "internal-and-cloud-load-balancing"], var.ingress)
    error_message = "Ingress must be 'all', 'internal', or 'internal-and-cloud-load-balancing'."
  }
}

# Domain mapping
variable "domain" {
  description = "Custom domain for the API service (optional)"
  type        = string
  default     = ""
}
