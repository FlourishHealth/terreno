variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "flourish-terreno"
}

variable "region" {
  description = "GCP region for storage buckets"
  type        = string
  default     = "us-east1"
}

variable "service_account_email" {
  description = "Service account email for CI/CD bucket access"
  type        = string
}

variable "apps" {
  description = "Map of app configs for GCS + CDN hosting"
  type = map(object({
    bucket_name          = string
    backend_bucket_name  = string
  }))
  default = {
    demo = {
      bucket_name         = "flourish-terreno-terreno-demo"
      backend_bucket_name = "terreno-demo-backend"
    }
    frontend-example = {
      bucket_name         = "flourish-terreno-terreno-frontend-example"
      backend_bucket_name = "terreno-frontend-example-backend"
    }
  }
}
