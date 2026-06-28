# secret module

Creates a Secret Manager **secret container** (no version). Versions are managed out-of-band so secret material never lands in Terraform state or in git.

## Seeding a value

```bash
# Add the first version interactively:
echo -n 'the-real-secret-value' | \
  gcloud secrets versions add SECRET_ID --project PROJECT_ID --data-file=-
```

Cloud Run services that mount this secret via `--set-secrets` always pull `latest`, so rotating just means adding a new version.

## Listing versions

```bash
gcloud secrets versions list SECRET_ID --project PROJECT_ID
```
