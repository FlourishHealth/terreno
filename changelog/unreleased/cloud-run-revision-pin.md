---
category: Fixed
---

The `cloud_run_service` Terraform module no longer ignores `template.revision`.
Ignoring it pinned the live revision name in state, so any structural change
failed with Cloud Run 409 `Revision named '<name>' with different configuration
already exists`. The Cloud Tasks queue now also waits on the IAM module so the
first apply cannot 403 on `cloudtasks.queues.create`.
