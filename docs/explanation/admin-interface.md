# How admin interfaces are shaped

Prefer existing admin packages over a new dashboard. `@terreno/admin-backend`
exposes `/admin/config` plus per-model CRUD. `@terreno/admin-frontend` renders that
config as a sidebar, home dashboard, tables, and forms. `@terreno/admin-spa` is the
same UI served from the API origin.

Consumer screens are thin routes. They wrap `AdminProvider` + `AdminShellLayout` and
let `AdminHome`, `AdminScreenRouter`, `AdminModelTable`, and `AdminModelForm` do the
work. Hand-write a route only when the generic table/form cannot express the
workflow (consent publish, comms message detail, password-on-create).

## Two hosts

| Host | When to use | Route prefix (`routeBase`) | API prefix (`apiBase`) |
| --- | --- | --- | --- |
| Embedded (`example-frontend/app/admin`) | Admin lives inside the product Expo app | `"/admin"` | `"/admin"` |
| Standalone (`@terreno/admin-spa`) | Same-origin console served by `AdminSpaServeApp` | `""` (SPA root; mount is `/console`) | `"/admin"` |

`apiBase` is the HTTP path for `/config` and CRUD. `routeBase` is the Expo Router
prefix the sidebar concatenates onto `/{model.name}` and `/{screen.name}`. Mixing
them puts nav on the wrong URL.

## Screen kinds

| Kind | Source of truth | Frontend |
| --- | --- | --- |
| Model changelist / form | `modelRouter({admin: ...})` or plugin `adminContribution()` | `AdminScreenRouter` → `AdminModelTable` / `AdminModelForm` |
| Custom screen | `AdminApp.customScreens` or plugin `customScreens` (`name` + `displayName`) | Matching `AdminProvider.widgets.screens[name]`, or a dedicated Expo route |
| Platform tool | Built-in (`scripts`, `roles`, `version`, `configuration`, audit log, feature flags) | Sidebar **Platform** section; visibility from `/admin/config.platformTools` |
| Home widget | `AdminApp.home.slots` IDs | `AdminProvider.widgets.home` (built-ins already registered) |

`GET /admin/config` is caller-specific. Models and custom screens without read
access are omitted. The sidebar must not invent links the config did not return.

## Navigation chrome

`AdminShell` (via `AdminShellLayout`) always owns the sidebar. Do not add a second
app-level nav inside admin.

Order in the rail:

1. **Home** → `{routeBase}/`
2. **Models** grouped by `admin.group` (ungrouped models land in **General**)
3. **Screens** from config `customScreens` (plus optional host extras)
4. **Platform** — Scripts (`/__scripts`), Roles, Version, Audit Log, Feature Flags, Configuration

Audit log and Feature Flags are models, but the shell lifts them into Platform so
operators do not hunt for them among business collections.

Below 768px the rail becomes a hamburger drawer. The main column is a body-style
canvas (`neutral-050`). Nested `Page` screens use `color="transparent"` and
`padding={0}` so cards sit on that canvas. Custom screens wrap content in
`AdminScreenPage`; the back arrow uses `router.push(routeBase)` rather than
`router.back()` because sidebar clicks do not always leave history on web.

## Where code goes

| Concern | Location |
| --- | --- |
| Which models appear | `modelRouter` `admin` block, or plugin `adminContribution()` |
| Extra non-CRUD pages | `AdminApp.customScreens` + `widgets.screens` with the **same** `name` |
| Home dashboard composition | `AdminApp.home.slots` |
| Field widgets | `admin.fieldOverrides.widget` + `widgets.fields` |
| Expo files | `app/admin/_layout.tsx` (shell once) or per-route shell in admin-spa |
| Dedicated extra segments (`/comms/:id`) | Explicit Expo files so `[model]/[id]` does not treat them as generic forms |
| Data fetching | `useAdminConfig` / `useAdminApi` (RTK). Admin is **not** a syncdb collection |

## Related

- [Build admin screens](../how-to/build-admin-screens.md)
- [Add a model to the admin](../how-to/admin-add-model.md)
- [Customize the admin home](../how-to/admin-custom-home.md)
- [Add a custom admin field widget](../how-to/admin-custom-widget.md)
- [Admin plugin frontend widgets](admin-plugin-frontend.md)
- [admin-frontend reference](../reference/admin-frontend.md)
- [admin-config reference](../reference/admin-config.md)
