#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <terraform-preview|terraform-apply|backend-prod|backend-preview|tasks-prod|mcp-prod|cleanup-preview>" >&2
  exit 2
fi

action="$1"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [ -z "${GCP_WIF_PROVIDER_PROD:-}" ] || [ -z "${GCP_TF_ADMIN_SA_PROD:-}${GCP_CD_DEPLOYER_SA_PROD:-}" ]; then
  echo "Skipping GCP ${action}: terreno-gcp is missing GCP_WIF_PROVIDER_PROD or deployer SA emails."
  echo "GitHub Actions still owns live CD until that CircleCI context is populated."
  exit 0
fi

export GCP_PROJECT_ID="${GCP_PROJECT_ID:-flourish-terreno}"
export GCP_BACKEND_REGION="${GCP_BACKEND_REGION:-us-central1}"
export GCP_BACKEND_SERVICE="${GCP_BACKEND_SERVICE:-terreno-backend-example}"
export GCP_TASKS_SERVICE="${GCP_TASKS_SERVICE:-terreno-backend-example-tasks}"
export GCP_TASKS_QUEUE="${GCP_TASKS_QUEUE:-terreno-example-jobs}"
export GCP_TASKS_INVOKER_SA="${GCP_TASKS_INVOKER_SA:-terreno-jobs-invoker@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
export GCP_BACKEND_RUNTIME_SA="${GCP_BACKEND_RUNTIME_SA:-terreno-backend-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
export GCP_MCP_REGION="${GCP_MCP_REGION:-us-east1}"
export GCP_MCP_SERVICE="${GCP_MCP_SERVICE:-terreno-mcp}"
export TF_DEPLOYMENT="${TF_DEPLOYMENT:-terreno-prod}"

gcp_auth() {
  scripts/ci/gcp-auth.sh
}

configure_registry() {
  local region="$1"
  gcloud auth configure-docker "${region}-docker.pkg.dev" --quiet
}

service_url() {
  local service="$1"
  gcloud run services describe "$service" \
    "--project=$GCP_PROJECT_ID" \
    "--region=$GCP_BACKEND_REGION" \
    --format='value(status.url)'
}

tagged_service_url() {
  local service="$1"
  local tag="$2"
  local canonical_url
  canonical_url="$(service_url "$service")"
  echo "https://${tag}---${canonical_url#https://}"
}

backend_runtime_sa_flag() {
  if gcloud iam service-accounts describe "$GCP_BACKEND_RUNTIME_SA" \
    "--project=$GCP_PROJECT_ID" >/dev/null 2>&1; then
    echo "--service-account=$GCP_BACKEND_RUNTIME_SA"
  fi
}

jobs_env_vars() {
  local tag="$1"
  local canonical_tasks_url
  local target_tasks_url
  canonical_tasks_url="$(service_url "$GCP_TASKS_SERVICE")"
  target_tasks_url="$canonical_tasks_url"
  if [ "$tag" != "prod" ]; then
    target_tasks_url="$(tagged_service_url "$GCP_TASKS_SERVICE" "$tag")"
  fi
  echo "JOBS_RUNNER=gcp-cloud-tasks,GCP_TASKS_PROJECT=${GCP_PROJECT_ID},GCP_TASKS_LOCATION=${GCP_BACKEND_REGION},GCP_TASKS_QUEUE=${GCP_TASKS_QUEUE},GCP_TASKS_PUBLIC_URL=${target_tasks_url},GCP_TASKS_OIDC_AUDIENCE=${canonical_tasks_url},GCP_TASKS_SERVICE_ACCOUNT_EMAIL=${GCP_TASKS_INVOKER_SA}"
}

deploy_backend() {
  local tag="$1"
  local image="${GCP_BACKEND_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_BACKEND_SERVICE}/${GCP_BACKEND_SERVICE}:${CIRCLE_SHA1}"
  configure_registry "$GCP_BACKEND_REGION"
  docker build --file example-backend/Dockerfile --tag "$image" .
  if [ "$tag" != "prod" ]; then
    SMOKE_IMAGE="$image" SMOKE_MODE=preview PR_NUMBER="$PR_NUMBER" \
      GITHUB_RUN_ID="${CIRCLE_WORKFLOW_ID:-circleci}" GITHUB_RUN_ATTEMPT=1 \
      .github/workflows/scripts/backend-container-smoke.sh
  fi
  docker push "$image"

  secrets="MONGO_URI=${GCP_BACKEND_SERVICE}-mongodb-uri:latest,LANGFUSE_SECRET_KEY=${GCP_BACKEND_SERVICE}-langfuse-secret-key:latest,LANGFUSE_PUBLIC_KEY=${GCP_BACKEND_SERVICE}-langfuse-public-key:latest"
  env_vars="NODE_ENV=production,ADMIN_SPA_ENABLED=true,CROSS_DOMAIN_AUTH_COOKIES=true,JOBS_START_WORKER=true,$(jobs_env_vars "$tag")"
  args=(
    run deploy "$GCP_BACKEND_SERVICE"
    "--project=$GCP_PROJECT_ID"
    "--region=$GCP_BACKEND_REGION"
    "--image=$image"
    "--tag=$tag"
    "--port=3000"
    "--memory=512Mi"
    "--min-instances=0"
    "--max-instances=10"
    "--concurrency=80"
    "--timeout=300"
    --allow-unauthenticated
  )
  runtime_sa_flag="$(backend_runtime_sa_flag)"
  if [ -n "$runtime_sa_flag" ]; then
    args+=("$runtime_sa_flag")
  fi

  better_auth_secret="${GCP_BACKEND_SERVICE}-better-auth-secret"
  if gcloud secrets versions access latest --secret="$better_auth_secret" >/dev/null 2>&1; then
    secrets+=",BETTER_AUTH_SECRET=${better_auth_secret}:latest"
    if [ "$tag" = "prod" ]; then
      better_auth_url="https://terreno-backend-example-7knxlrnpqq-uc.a.run.app"
    else
      better_auth_url="https://${tag}---terreno-backend-example-7knxlrnpqq-uc.a.run.app"
    fi
    env_vars+=",AUTH_PROVIDER=better-auth,BETTER_AUTH_URL=${better_auth_url}"
  fi

  if [ "$tag" = "prod" ]; then
    env_vars+=",CORS_ORIGINS=https://terreno-frontend.netlify.app"
  else
    args+=(--no-traffic)
    env_vars+=",CORS_ORIGINS=https://pr-${PR_NUMBER}--terreno-frontend.netlify.app,MONGO_DB_NAME=terreno-example-pr-${PR_NUMBER},SEED_DEFAULTS=true"
  fi
  args+=("--set-secrets=$secrets" "--set-env-vars=$env_vars")
  gcloud "${args[@]}"
}

deploy_tasks() {
  local tag="$1"
  local image="${GCP_BACKEND_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_TASKS_SERVICE}/${GCP_TASKS_SERVICE}:${CIRCLE_SHA1}"
  configure_registry "$GCP_BACKEND_REGION"
  docker build --file example-backend/Dockerfile --tag "$image" .
  docker push "$image"

  local env_vars="NODE_ENV=production,BACKEND_SERVICE=tasks,FLOURISH_SERVICE=${GCP_TASKS_SERVICE},JOBS_START_WORKER=false,$(jobs_env_vars "$tag")"
  local args=(
    run deploy "$GCP_TASKS_SERVICE"
    "--project=$GCP_PROJECT_ID"
    "--region=$GCP_BACKEND_REGION"
    "--image=$image"
    "--tag=$tag"
    "--port=3000"
    "--memory=512Mi"
    "--min-instances=0"
    "--max-instances=10"
    "--concurrency=20"
    "--timeout=1800"
    --no-allow-unauthenticated
  )
  if [ "$tag" != "prod" ]; then
    args+=(--no-traffic)
    env_vars+=",MONGO_DB_NAME=terreno-example-pr-${PR_NUMBER},PR_NUMBER=${PR_NUMBER}"
  fi
  args+=(
    "--set-env-vars=$env_vars"
    "--set-secrets=MONGO_URI=${GCP_BACKEND_SERVICE}-mongodb-uri:latest,LANGFUSE_SECRET_KEY=${GCP_BACKEND_SERVICE}-langfuse-secret-key:latest,LANGFUSE_PUBLIC_KEY=${GCP_BACKEND_SERVICE}-langfuse-public-key:latest"
  )
  gcloud "${args[@]}"
}

case "$action" in
  terraform-preview)
    scripts/ci/validate-env.sh PR_NUMBER
    export GCP_SERVICE_ACCOUNT="${GCP_TF_ADMIN_SA_PROD:-}"
    gcp_auth
    location="${GCP_INFRA_MANAGER_LOCATION:-us-central1}"
    preview_id="${TF_DEPLOYMENT}-pr${PR_NUMBER}-${CIRCLE_BUILD_NUM:-manual}"
    trap 'gcloud infra-manager previews delete "$preview_id" --location="$location" --project="$GCP_PROJECT_ID" --quiet || true' EXIT
    preview_create_status=0
    gcloud infra-manager previews create "$preview_id" \
      "--project=$GCP_PROJECT_ID" \
      "--location=$location" \
      "--deployment=projects/${GCP_PROJECT_ID}/locations/${location}/deployments/${TF_DEPLOYMENT}" \
      "--service-account=projects/${GCP_PROJECT_ID}/serviceAccounts/${GCP_TF_ADMIN_SA_PROD}" \
      --local-source=terraform \
      --quiet || preview_create_status=$?
    # Dump errorCode/errorLogs even when create fails. gcloud often prints an
    # empty "failed while running step:" line and nothing else.
    gcloud infra-manager previews describe "$preview_id" \
      "--location=$location" \
      "--project=$GCP_PROJECT_ID" \
      --format='yaml(state,errorCode,errorLogs,buildResults)' || true
    if [ "$preview_create_status" -ne 0 ]; then
      exit "$preview_create_status"
    fi
    ;;
  terraform-apply)
    export GCP_SERVICE_ACCOUNT="${GCP_TF_ADMIN_SA_PROD:-}"
    gcp_auth
    location="${GCP_INFRA_MANAGER_LOCATION:-us-central1}"
    gcloud infra-manager deployments apply "$TF_DEPLOYMENT" \
      "--project=$GCP_PROJECT_ID" \
      "--location=$location" \
      "--service-account=projects/${GCP_PROJECT_ID}/serviceAccounts/${GCP_TF_ADMIN_SA_PROD}" \
      --local-source=terraform \
      --quiet
    ;;
  backend-prod)
    export GCP_SERVICE_ACCOUNT="${GCP_CD_DEPLOYER_SA_PROD:-}"
    gcp_auth
    deploy_backend prod
    ;;
  backend-preview)
    scripts/ci/validate-env.sh PR_NUMBER
    export GCP_SERVICE_ACCOUNT="${GCP_CD_DEPLOYER_SA_PROD:-}"
    gcp_auth
    deploy_tasks "pr-${PR_NUMBER}"
    deploy_backend "pr-${PR_NUMBER}"
    ;;
  tasks-prod)
    export GCP_SERVICE_ACCOUNT="${GCP_CD_DEPLOYER_SA_PROD:-}"
    gcp_auth
    deploy_tasks prod
    ;;
  mcp-prod)
    export GCP_SERVICE_ACCOUNT="${GCP_CD_DEPLOYER_SA_PROD:-}"
    gcp_auth
    configure_registry "$GCP_MCP_REGION"
    scripts/ci/validate-env.sh MCP_SENTRY_DSN
    image="${GCP_MCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_MCP_SERVICE}/${GCP_MCP_SERVICE}:${CIRCLE_SHA1}"
    docker build --file mcp-server/Dockerfile --tag "$image" .
    docker push "$image"
    gcloud run deploy "$GCP_MCP_SERVICE" \
      "--project=$GCP_PROJECT_ID" \
      "--region=$GCP_MCP_REGION" \
      "--image=$image" \
      --cpu=1 \
      --memory=512Mi \
      --min-instances=0 \
      --max-instances=10 \
      --concurrency=80 \
      --timeout=300 \
      --allow-unauthenticated \
      "--set-env-vars=SENTRY_DSN=${MCP_SENTRY_DSN}"
    ;;
  cleanup-preview)
    scripts/ci/validate-env.sh PR_NUMBER
    export GCP_SERVICE_ACCOUNT="${GCP_CD_DEPLOYER_SA_PROD:-}"
    gcp_auth
    gcloud run services update-traffic "$GCP_BACKEND_SERVICE" \
      "--remove-tags=pr-${PR_NUMBER}" \
      "--region=$GCP_BACKEND_REGION" || true
    gcloud run services update-traffic "$GCP_TASKS_SERVICE" \
      "--remove-tags=pr-${PR_NUMBER}" \
      "--region=$GCP_BACKEND_REGION" || true
    export MONGO_URI
    MONGO_URI="$(gcloud secrets versions access latest --secret="${GCP_BACKEND_SERVICE}-mongodb-uri")"
    export MONGO_DB_NAME="terreno-example-pr-${PR_NUMBER}"
    node --input-type=module -e '
      import("mongodb").then(async ({MongoClient}) => {
        const client = new MongoClient(process.env.MONGO_URI);
        await client.connect();
        await client.db(process.env.MONGO_DB_NAME).dropDatabase();
        await client.close();
        console.info(`Dropped preview database ${process.env.MONGO_DB_NAME}`);
      });
    '
    ;;
  *)
    echo "Unknown GCP deploy action: $action" >&2
    exit 2
    ;;
esac
