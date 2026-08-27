resource "google_iam_workload_identity_pool" "this" {
  project                   = var.project_id
  workload_identity_pool_id = "circleci"
  display_name              = "CircleCI"
  description               = "OIDC federation for Terreno CircleCI deployments."
}

resource "google_iam_workload_identity_pool_provider" "circleci" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.this.workload_identity_pool_id
  workload_identity_pool_provider_id = "circleci"
  display_name                       = "CircleCI"

  attribute_mapping = {
    "google.subject"       = "assertion.aud + '/' + assertion.sub.extract('/user/{user_id}/')"
    "attribute.org_id"     = "assertion.aud"
    "attribute.project_id" = "assertion['oidc.circleci.com/project-id']"
    "attribute.sub"        = "assertion.sub"
  }

  attribute_condition = trimspace(var.circleci_gcp_context_id) == "" ? "attribute.org_id == '${var.circleci_org_id}' && attribute.project_id == '${var.circleci_project_id}'" : "attribute.org_id == '${var.circleci_org_id}' && attribute.project_id == '${var.circleci_project_id}' && '${var.circleci_gcp_context_id}' in assertion['oidc.circleci.com/context-ids']"

  oidc {
    issuer_uri        = "https://oidc.circleci.com/org/${var.circleci_org_id}"
    allowed_audiences = [var.circleci_org_id]
  }

  lifecycle {
    precondition {
      condition     = var.circleci_gcp_context_id != ""
      error_message = "Set circleci_gcp_context_id to the terreno-gcp CircleCI context UUID so WIF rejects jobs that omit that context."
    }
  }
}

resource "google_service_account_iam_member" "circleci_wif_user" {
  for_each = var.service_account_names

  service_account_id = each.value
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.this.name}/attribute.project_id/${var.circleci_project_id}"
}
