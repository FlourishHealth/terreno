output "bucket_urls" {
  description = "GCS bucket URLs"
  value = {
    for key, app in var.apps : key => "gs://${google_storage_bucket.site[key].name}"
  }
}

output "cdn_ips" {
  description = "CDN IP addresses"
  value = {
    for key, app in var.apps : key => google_compute_global_address.site[key].address
  }
}
