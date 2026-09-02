# Upgrade notes

Per-release notes for `terreno_get_upgrade_guide`. One file per published version: `<version>.md` (for example `57.2.0.md`). This README is format documentation only and is **not** concatenated into a version range.

`terreno_get_upgrade_guide` concatenates every matching note in the requested range. Each note must be **self-contained** and must not assume the reader read an adjacent note.

Existing notes such as `0.20.0.md` and `0.21.0.md` predate this template. Keep them as-is. New notes use the sections below. Extra sections are allowed; do not omit a required section — write `None` when a section has nothing to report.

## Required header

Start with the version heading, then these two lines:

````markdown
# Upgrading to <version>

**Action required:** Yes | No
**Affected packages:** @terreno/api, @terreno/ui
````

`Action required` is `Yes` when a consumer must change code, config, or dependencies. List only packages whose public surface the consumer must touch.

## Required sections

| Section | Purpose |
| --- | --- |
| Summary | One short paragraph of what this version does for a consumer |
| Breaking changes | Each change is its own `###` heading with **What changed**, **Why**, and **Migration** (before-and-after code) |
| Deprecations | What is still supported, until when, and the replacement |
| New capabilities | Additions a consumer may opt into. Write `None` when there are none |
| Verification | Concrete commands or checks that prove this version's upgrade succeeded |

## Copy-paste template

````markdown
# Upgrading to <version>

**Action required:** Yes
**Affected packages:** @terreno/api

## Summary

<one paragraph>

## Breaking changes

### <change title>

**What changed**

<what a consumer sees>

**Why**

<reason, one or two sentences>

**Migration**

```typescript
// Before
oldCall();

// After
newCall();
```

## Deprecations

None

## New capabilities

None

## Verification

- `bun run compile` and `bun run lint` at the app root
- `cd <your frontend> && bun run sdk` after any `@terreno/api` route or model surface change
````
