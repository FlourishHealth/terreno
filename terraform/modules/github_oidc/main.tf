resource "google_iam_workload_identity_pool" "this" {
  project                   = var.project_id
  workload_identity_pool_id = var.pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC federation for GitHub Actions deployments."
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.this.workload_identity_pool_id
  workload_identity_pool_provider_id = var.provider_id
  display_name                       = "GitHub"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
    "attribute.actor"      = "assertion.actor"
  }

  # Restrict to the configured owner so the pool can't be impersonated by other orgs.
  attribute_condition = "assertion.repository_owner == '${var.github_owner}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "sa" {
  for_each = var.service_accounts

  project      = var.project_id
  account_id   = each.key
  display_name = coalesce(each.value.display_name, each.key)
  description  = each.value.description
}

# Flatten {sa_name => roles} into one row per (sa_name, role) so we can create
# one project-level IAM binding per role.
locals {
  sa_role_bindings = merge([
    for sa_name, sa in var.service_accounts : {
      for role in sa.roles :
      "${sa_name}|${role}" => { sa_name = sa_name, role = role }
    }
  ]...)

  # One row per (sa_name, github_repo) for workloadIdentityUser bindings.
  sa_repo_bindings = merge([
    for sa_name in keys(var.service_accounts) : {
      for repo in var.github_repos :
      "${sa_name}|${repo}" => { sa_name = sa_name, repo = repo }
    }
  ]...)
}

resource "google_project_iam_member" "sa_roles" {
  for_each = local.sa_role_bindings

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.sa[each.value.sa_name].email}"
}

resource "google_service_account_iam_member" "wif_user" {
  for_each = local.sa_repo_bindings

  service_account_id = google_service_account.sa[each.value.sa_name].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.this.name}/attribute.repository/${each.value.repo}"
}
