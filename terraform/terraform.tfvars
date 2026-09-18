project_id        = "flourish-terreno"
project_number    = "966061500091"
environment       = "prod"
state_bucket_name = "flourish-terreno-tfstate-prod"

github_owner = "FlourishHealth"
github_repos = ["FlourishHealth/terreno"]

backend_region       = "us-central1"
mcp_region           = "us-east1"
backend_service_name = "terreno-backend-example"
tasks_service_name   = "terreno-backend-example-tasks"
jobs_queue_name      = "terreno-example-jobs-v2"
mcp_service_name     = "terreno-mcp"

backend_min_instances = 0
tasks_min_instances   = 0

jobs_queue_max_concurrent_dispatches = 20
jobs_queue_max_dispatches_per_second = 20
