---
category: Added
---

MongoDB migrations tooling: `terreno-migrate` (`check` / `generate` / `status` / `up` / `down`), `TerrenoApp` `migrations.runOnStart`, admin **Migrations** page, and `example-backend/migrations/`. Admin HTTP is `modelRouter` collection actions `GET /admin/migrations/status` and `POST /admin/migrations/run` (`{data: ...}`), documented in `/openapi.json` under the `adminMigrations` tag. Production wet apply requires `ALLOW_MIGRATIONS=true`. History lives in `terreno_migrations` and is not wiped by seed `--reset`.
