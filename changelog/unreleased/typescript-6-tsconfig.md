---
category: Changed
---

Every tsconfig builds on TypeScript 6 without `ignoreDeprecations`. Node packages (`@terreno/api`, `ai`, `admin-backend`, `announcements`, `api-health`, `comms`, `feature-flags`, `jobs`, `test`, and the `admin-spa` server plugin) now compile with `module: nodenext` to ES2023 CommonJS instead of ES5. Their dynamic `import()` stays a real ESM import, so `loadMigrations` can load migration files by `file://` URL from compiled `dist/`. Frontend libraries (`ui`, `admin-frontend`, `rtk`, `syncdb`) emit ES2022 with bundler resolution and ship declaration maps. `@terreno/test` no longer publishes its compiled Bun tests. `create-terreno-app` scaffolds drop `ignoreDeprecations` and `moduleResolution: node`, and the generated backend moves to TypeScript 6. See `docs/explanation/typescript-configuration.md`.
