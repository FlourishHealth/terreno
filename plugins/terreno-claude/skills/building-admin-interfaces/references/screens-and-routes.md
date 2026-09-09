# Screens and routes

Canonical steps: [Build admin screens](../../../../../docs/how-to/build-admin-screens.md).

## Embedded host (`example-frontend/app/admin`)

Wrap **once** in `_layout.tsx`: `AdminProvider` then `AdminShellLayout` then `Stack`.
Child routes must not wrap another shell.

| File | Component |
| --- | --- |
| `index.tsx` | `AdminHome` |
| `[model]/index.tsx` | `AdminScreenRouter` with `name={model}` |
| `[model]/create.tsx` | `AdminModelForm` `mode="create"` |
| `[model]/[id].tsx` | `AdminModelForm` |
| Extra folders (`comms/`, `consent-forms/`, `configuration.tsx`) | Only when generic CRUD is not enough |

Create is **`create`**, not `new`.

## Standalone host (`admin-spa/app`)

Root `_layout.tsx` is providers + `AdminGate` only. **Each screen** wraps
`AdminShellLayout` because there is no shared admin stack layout. `routeBase=""`.
`apiBase` comes from `app-config.json` (`adminApiBasePath`, default `/admin`).

## `AdminScreenRouter`

Resolves one URL segment:

1. `__scripts` → `AdminScriptList`
2. Config model `name` → `AdminModelTable`
3. `widgets.screens[name]` → custom screen widget
4. Config `customScreens` without a widget → missing-widget placeholder
5. Else not-found

Model **names** (Mongoose model name, or a unique suffix like `Food-archived-foods`)
are the URL segment, not `routePath` (`/admin/users`).

## Dedicated routes vs widgets

Prefer a `widgets.screens` component so `[model]/index` can render it. Add a
dedicated Expo file when:

- The path has more segments than `/admin/:name` (comms message `/comms/:id`).
- The screen must not share the generic create/edit form (consent editor).
- The host is admin-spa and you want a static export path (optional; the
  `[model]` fallback already covers single-segment custom screens).

Expo file routes win over `[model]` when the folder name is literal
(`comms/index.tsx` beats `[model]/index.tsx` for `/admin/comms`).
