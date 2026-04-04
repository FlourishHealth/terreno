# Production environment configuration
project_id = "flourish-terreno"
region     = "us-central1"
app_name   = "terreno"

# Bootstrap: set to false for first run, then true after pushing first image
deploy_service = false

# Cloud Run sizing
api_cpu           = "1000m"
api_memory        = "1Gi"
api_min_instances = 0
api_max_instances = 10
api_concurrency   = 80

# Custom domain (optional — configure DNS separately)
# domain = "api.terreno.flourish.health"

# Environment variables
env_vars = {
  PORT      = "8080"
  LOG_LEVEL = "info"
}

# Secrets — env var name -> Secret Manager secret ID
secrets = {
  MONGO_CONNECTION     = "MONGO_CONNECTION"
  TOKEN_SECRET         = "TOKEN_SECRET"
  REFRESH_TOKEN_SECRET = "REFRESH_TOKEN_SECRET"
  SESSION_SECRET       = "SESSION_SECRET"
  LANGFUSE_SECRET_KEY  = "LANGFUSE_SECRET_KEY"
  LANGFUSE_PUBLIC_KEY  = "LANGFUSE_PUBLIC_KEY"
}
