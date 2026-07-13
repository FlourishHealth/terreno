---
targets: ["cursor", "devin", "copilot", "claudecode"]
description: "Use Bun catalog for dependencies shared across packages"
globs: ["**/package.json"]
---

# Dependency Catalog

This monorepo uses [Bun Catalogs](https://bun.sh/docs/install/catalogs) to keep a
single source of truth for the version of every dependency that is shared by more
than one workspace package. Shared versions live in the root `package.json` under
the `catalog` field, and workspace packages reference them with `"catalog:"`.

## Rule

Any dependency used by **two or more** workspace packages **must** be declared in
the root `catalog` and referenced with `"catalog:"` from every package that uses
it. This applies to `dependencies` and `devDependencies` alike (and to
`peerDependencies` where the repo already uses `catalog:`).

When you add, upgrade, or move a dependency:

1. **Check the root `catalog` first.** If the package is already there, reference
   it with `"catalog:"` instead of pinning a raw version.
2. **If a dependency becomes shared** (a second package starts using it), add it
   to the root `catalog` and switch every consumer to `"catalog:"`.
3. **To bump a shared dependency**, change the version in the root `catalog` once
   — never edit the version in individual packages.
4. **Single-use dependencies** (used by exactly one package) may keep a raw
   version range and do **not** need a catalog entry.
5. **Keep the `catalog` entries sorted** alphabetically by package name.

## Examples

Correct — a shared dependency referenced from a workspace package:

```jsonc
// root package.json
{
  "catalog": {
    "express": "^5.2.1",
    "luxon": "^3.7.2"
  }
}

// api/package.json
{
  "dependencies": {
    "express": "catalog:",
    "luxon": "catalog:"
  }
}
```

Wrong — pinning a raw version of a dependency that is shared and already in the
catalog:

```jsonc
// api/package.json
{
  "dependencies": {
    "express": "^5.2.1", // ❌ use "catalog:" instead
    "luxon": "^3.7.2"    // ❌ use "catalog:" instead
  }
}
```

## Intentional exceptions

A few dependencies are deliberately **not** catalogued because their version
genuinely diverges by environment, and forcing a single version would break a
consumer. Keep these as raw version ranges:

- `@types/node` — backend packages track the Node 25 types while the Expo/web
  packages (`demo`, `website`) stay on Node 22 types.
- `path-to-regexp` — pinned to different majors by `@terreno/api` (v6) and
  `@terreno/example-backend` (v8) to match their respective Express/router
  internals.
- `@opentelemetry/sdk-node` — OpenTelemetry packages are tightly version-coupled
  per app and are pinned independently.

When introducing a new divergence like this, document it here so future changes
don't "fix" it by collapsing the versions into the catalog.
