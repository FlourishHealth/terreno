# @terreno/admin-spa

Opt-in package that lets any Terreno backend serve a pre-built admin SPA from the
same Node process — no separate static-site deploy to GCS/Netlify/Cloudflare Pages.

The default backend image stays small: React/Expo assets only ship in the npm
tarball for consumers who actually register the plugin. The embedded admin use case
(admin screens inside a consumer's main Expo app, as `example-frontend/app/admin/*`
does) remains supported and unchanged.

## What's here today

This package currently ships the **backend serving plugin** (`AdminSpaServeApp`) and
its runtime app-config contract. It serves a pre-built Expo Router static export
(`dist/`) from a Terreno backend.

> The SPA frontend itself (`app/`, `store/`, `components/`) and the
> `@terreno/admin-frontend` `apiBase`/`routeBase` prop split it depends on are a
> follow-up. Until the bundle is built, the plugin serves `app-config.json` and a
> placeholder `index.html`, or proxies to a running Expo dev server via
> `devProxyTarget`.

## Install

```bash
bun add @terreno/admin-spa
```

`@terreno/api` is a peer dependency.

## Register with a backend

```typescript
import {AdminSpaServeApp} from "@terreno/admin-spa";
import {AdminApp} from "@terreno/admin-backend";
import {BetterAuthApp, TerrenoApp} from "@terreno/api";

new TerrenoApp({userModel: User})
  .register(new BetterAuthApp({config: betterAuthConfig, userModel: User}))
  .register(new AdminApp({models: [...]}))
  .register(
    new AdminSpaServeApp({
      basePath: "/console", // default; non-breaking with the /admin API
      appConfig: {
        brandName: "Acme Admin",
        logoUrl: "/static/logo.svg",
        primaryColor: "#FF6B35",
        providers: ["email", "google"],
      },
    })
  )
  .start();
```

Open `https://api.acme.com/console/` → admin UI. Same-origin → Better-Auth session
cookies attach automatically, no CORS.

## Options (`AdminSpaServeOptions`)

| Option | Default | Description |
|---|---|---|
| `basePath` | `/console` | Path the SPA mounts at. The `/admin` API is untouched. |
| `appConfig` | see below | Runtime config served at `${basePath}/app-config.json`. Merged over defaults. |
| `distDir` | `<pkg>/dist` | Override the pre-built bundle directory (tests / custom builds). |
| `devProxyTarget` | — | In dev, proxy all SPA paths to a running `expo start --web`, e.g. `http://localhost:8083`. |

### App config

`app-config.json` lets a single pre-built bundle be themed and pointed at the right
auth/admin API paths per consumer without rebuilding. Defaults:

```typescript
{
  brandName: "Terreno Admin",
  primaryColor: "#2563EB",
  providers: ["email"],
  authBasePath: "/api/auth",
  adminApiBasePath: "/admin",
}
```

## How serving works

- `${basePath}/_expo` and `${basePath}/assets` are served with
  `Cache-Control: public, max-age=31536000, immutable`.
- `${basePath}/app-config.json` and `index.html` are served with
  `Cache-Control: no-store`.
- `index.html`'s absolute `/_expo/` and `/assets/` references are rewritten once at
  boot to `${basePath}/...`, so one pre-built bundle works at any `basePath`.
- SPA fallback: both the bare `${basePath}` and `${basePath}/*splat` return
  `index.html` (Express 5 named-splat convention).

## Build / publish (follow-up)

When the SPA frontend lands, `dist/` is produced by
`bun expo export --platform web --output-dir dist` (run in `prepublishOnly`) and
shipped via `files: ["src/dist/**", "dist/**"]`. A CI publish job must run the web
export before `bun publish` so the tarball's `dist/` is populated.

## Comparison with embedded admin-frontend

| | Standalone SPA (`@terreno/admin-spa`) | Embedded (`@terreno/admin-frontend`) |
|---|---|---|
| Deploy | Served by the API process at `/console` | Bundled into the consumer's Expo app |
| Backend footprint | Opt-in; no React in default image | n/a |
| Auth | Better-Auth same-origin cookies | Consumer's existing auth |
