resource "google_secret_manager_secret" "this" {
  project   = var.project_id
  secret_id = var.secret_id
  labels    = var.labels

  dynamic "replication" {
    for_each = length(var.replication_locations) == 0 ? [1] : []
    content {
      auto {}
    }
  }

  dynamic "replication" {
    for_each = length(var.replication_locations) == 0 ? [] : [1]
    content {
      user_managed {
        dynamic "replicas" {
          for_each = toset(var.replication_locations)
          content {
            location = replicas.value
          }
        }
      }
    }
  }
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each = toset(var.accessor_members)

  project   = var.project_id
  secret_id = google_secret_manager_secret.this.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value
}
