---
category: Fixed
---

Terraform preview CI now prints Infra Manager `errorCode` / `errorLogs` when
`previews create` fails, and `terraform-admin` gains `roles/logging.logWriter`
so Cloud Build can write regional logs.
