# GCS buckets for static site hosting
resource "google_storage_bucket" "site" {
  for_each = var.apps

  name                        = each.value.bucket_name
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true

  website {
    not_found_page = "index.html"
    # MainPageSuffix intentionally omitted to avoid GCS 301 redirects
    # that break client-side SPA routing (e.g. /demo/ -> /demo/index.html)
  }
}

# Public read access
resource "google_storage_bucket_iam_member" "public_read" {
  for_each = var.apps

  bucket = google_storage_bucket.site[each.key].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# CI/CD service account write access
resource "google_storage_bucket_iam_member" "ci_write" {
  for_each = var.apps

  bucket = google_storage_bucket.site[each.key].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.service_account_email}"
}

# CDN backend buckets
resource "google_compute_backend_bucket" "cdn" {
  for_each = var.apps

  name        = each.value.backend_bucket_name
  bucket_name = google_storage_bucket.site[each.key].name
  enable_cdn  = true
}

# URL maps
resource "google_compute_url_map" "site" {
  for_each = var.apps

  name            = "terreno-${each.key}-url-map"
  default_service = google_compute_backend_bucket.cdn[each.key].id
}

# Static IPs
resource "google_compute_global_address" "site" {
  for_each = var.apps

  name = "terreno-${each.key}-ip"
}

# HTTP proxies
resource "google_compute_target_http_proxy" "site" {
  for_each = var.apps

  name    = "terreno-${each.key}-http-proxy"
  url_map = google_compute_url_map.site[each.key].id
}

# Forwarding rules (HTTP)
resource "google_compute_global_forwarding_rule" "site" {
  for_each = var.apps

  name       = "terreno-${each.key}-forwarding-rule"
  target     = google_compute_target_http_proxy.site[each.key].id
  ip_address = google_compute_global_address.site[each.key].address
  port_range = "80"
}
