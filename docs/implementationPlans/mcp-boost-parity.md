# Implementation Plan: MCP Server — Boost Parity (Docs Search, Local Runtime Tools, Per-Package Guidelines, Upgrade Prompts)

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

## Overview

[laravel/boost](https://github.com/laravel/boost) is Laravel's MCP server for AI-assisted development. Its value comes from runtime context: it runs *inside* each app (stdio) and gives agents database schema, logs, last error, browser console output, and version-aware doc search. Terreno's MCP server is the opposite shape — a hosted, stateless codegen/docs service with no visibility into the consuming app.

This plan closes the gap with five additions, ordered by value:

1. **Docs search tools** on the hosted server (`terreno_search_docs`, `terreno_get_component_docs`) — agents call tools; they rarely read passive MCP resources.
2. **A local stdio companion** (`@terreno/mcp`, `terreno-mcp-local` bin) that runs inside consumer apps and exposes runtime introspection: package versions, Mongo schema, read-only queries, backend logs, last error.
3. **Browser/device log capture** — a dev-only frontend logger that ships console errors to the backend, where the local MCP can read them. Boost's most original feature, and arguably more valuable for React Native where agents can't see the simulator.
4. **Per-package guidelines and skills** — move AI guideline content out of the monolithic `mcp-server/src/bootstrap.ts` (~2,900 lines) into each package's `.ai/` directory, composed at build time and shipped in published npm packages.
5. **Upgrade prompts** — per-release upgrade notes plus a `terreno_upgrade` prompt. Frontend/Expo SDK work delegates to the official [`upgrading-expo` skill](https://github.com/expo/skills/tree/main/plugins/expo/skills/upgrading-expo) from `expo/skills`; the prompt handles the Terreno-specific parts (`@terreno/ui`, `@terreno/rtk`, `@terreno/api`).

**Key design decisions:**

- The hosted server stays stateless and unauthenticated; everything project-specific lives in the new local stdio server.
- `mcp-server` becomes a published package (`@terreno/mcp`) so consumers can run `bunx terreno-mcp-local` — it joins the nine lockstep-versioned packages in `publish-on-tag.yml`.
- Search is in-process BM25 (e.g. `minisearch`) over markdown chunked by heading — no external search service, works on Cloud Run with the index built at startup from bundled docs.
- The local server never imports consumer code. It reads `package.json`/`bun.lock`, connects to Mongo via the consumer's `.env`, and tails log files. This avoids version conflicts between the MCP's dependencies and the app's.
- Mongo query tool is read-only by allowlist (`find`, `aggregate` without `$out`/`$merge`, `countDocuments`, `distinct`), mirroring Boost's SQL allowlist.
- Log tools require `@terreno/api` to gain an opt-out dev-only file transport (`.terreno/logs/app.log`) since the winston logger is currently console-only (`api/src/logger.ts`).
- Browser logs flow frontend → backend dev endpoint → file → local MCP tool, rather than tailing Metro. This works identically for web and physical devices (which can already reach the backend).

**Related work:** `docs/implementationPlans/model-router-mcp.md` adds MCP tools to consumer apps' own APIs — that is the *app's* MCP surface; this plan is about the *development-time* MCP surface. The companion plan `docs-site-and-versioning.md` covers versioned documentation, which `terreno_search_docs` will consume once it exists.

## Phase 1: Docs Search Tools (hosted server)

### New files

```
mcp-server/src/search/
├── chunker.ts      # Split markdown into heading-level chunks with breadcrumb titles
├── index.ts        # Build minisearch index at startup from docs dir
└── search.ts       # Query API: multi-query, score merge, token-limited markdown output
```

### Tools (added in `mcp-server/src/tools.ts`)

```typescript
terreno_search_docs({
  queries: string[];      // multiple queries, like Boost ("toggle" vs "switch")
  packages?: string[];    // filter to @terreno/api, @terreno/ui, etc.
  tokenLimit?: number;    // default 3000, capped
})
// Returns ranked markdown chunks with source attribution.

terreno_get_component_docs({
  component: string;      // e.g. "Button"
})
// Returns the full props table for one @terreno/ui component from
// ui-types-documentation.json, plus any matching markdown docs.
```

### Corpus

- `mcp-server/src/docs/resources/*.md` (existing five bundles)
- `docs/**/*.md` from the monorepo (Diátaxis tree) — extend the `sync-ui-docs` script in `mcp-server/package.json` into a `sync-docs` script that copies both
- `ui-types-documentation.json` component entries, rendered to markdown chunks (one per component)

### Notes

- Update tool descriptions to instruct agents: "use this tool before guessing at Terreno APIs" (Boost's `search-docs` description does this aggressively and it works).
- Keep the existing static resources; they cost nothing.
- Tests in `mcp-server/src/__tests__/search.test.ts`: chunking, ranking sanity ("button" finds Button component), token truncation, package filtering.

## Phase 2: Per-Package Guidelines & Skills

### Structure

Each published package gains an `.ai/` directory:

```
api/.ai/
├── guidelines/core.md          # modelRouter, permissions, TerrenoApp patterns
└── skills/mongoose-schema-safety/SKILL.md   # moved from .rulesync/skills (consumer-relevant parts)
ui/.ai/guidelines/core.md
rtk/.ai/guidelines/core.md
admin-backend/.ai/guidelines/core.md
...
```

- Add `.ai` to each package's `files` in `package.json` so guidelines ship to `node_modules` (the Boost pattern: vendor packages carry their own guidelines).
- `mcp-server` gains a build step (`sync-package-guidelines`) that collects `*/.ai/**` into `src/docs/guidelines/<package>/`.

### Behavior changes

- `terreno_bootstrap_ai_rules` composes its output from the collected per-package files instead of inline strings in `bootstrap.ts`. Add an optional `packages` input (the agent passes the consumer's `@terreno/*` deps from `package.json`) so apps without e.g. `admin-backend` don't get admin guidelines.
- `bootstrap.ts` shrinks to orchestration + app-scaffold templates; guideline content lives next to the code it describes and is reviewed in the same PRs.
- The `improve-rulesync` skill should be updated to point contributors at the per-package `.ai/` dirs.

### Versioned guidelines (forward-looking)

Boost keys guidelines by package major version (`.ai/laravel/11/`, `12/`). Terreno releases in lockstep, so a flat `core.md` is fine until a breaking release; at that point add `.ai/guidelines/<major>/core.md` and have the composer pick by the consumer's installed version.

## Phase 3: Local Stdio Companion (`terreno-mcp-local`)

### Packaging

- Rename/publish `mcp-server` as `@terreno/mcp` with two bins:
  - `terreno-mcp` — existing HTTP entry (`src/index.ts`), unchanged
  - `terreno-mcp-local` — new stdio entry (`src/local/index.ts`) using `StdioServerTransport`
- Add to `publish-on-tag.yml` (depends on `publish-api` since it imports the logger).
- `terreno_bootstrap_app` writes both servers into the generated `.cursor/mcp.json`:

```jsonc
{
  "mcpServers": {
    "terreno": { "type": "http", "url": "https://mcp.terreno.flourish.health/mcp" },
    "terreno-local": { "command": "bunx", "args": ["terreno-mcp-local"] }
  }
}
```

### Tools

```
src/local/tools/
├── applicationInfo.ts   # application_info
├── databaseSchema.ts    # database_schema
├── databaseQuery.ts     # database_query
├── readLogs.ts          # read_log_entries, last_error
└── browserLogs.ts       # browser_logs (Phase 4)
```

- **`application_info`** — parse the consumer's root + workspace `package.json` and `bun.lock`; report `@terreno/*` versions, expo, react-native, mongoose, bun. Tool description copies Boost's trick: *"Use this tool at the start of each chat and write version-specific code."*
- **`database_schema`** — connect using `MONGO_URI` from the consumer backend's `.env`; list collections, indexes, and document counts; additionally parse `backend/src/models/*.ts` (static, no imports) to report declared fields, types, refs, and plugins. Summary mode + name filter, like Boost.
- **`database_query`** — read-only allowlist: `find`, `aggregate` (rejecting `$out`/`$merge`/`$function`), `countDocuments`, `distinct`. Hard result cap (default 50 docs), JSON output.
- **`read_log_entries`** / **`last_error`** — tail `.terreno/logs/app.log` (JSONL, multi-line safe); `last_error` returns the most recent `error`-level entry with stack.

### Required `@terreno/api` change

`api/src/logger.ts` gains a dev-only file transport: when `NODE_ENV !== "production"` (or `TERRENO_LOG_FILE` is set), winston also writes JSONL to `.terreno/logs/app.log` with rotation (cap ~5MB). `.terreno/` is added to the generated app's `.gitignore` by bootstrap.

### Project-root discovery

The local server resolves the consumer project root by walking up from `cwd` to the nearest `package.json` with a `backend`/`frontend` workspace (the bootstrap layout), with a `TERRENO_PROJECT_ROOT` override.

## Phase 4: Browser/Device Log Capture

### Frontend (`@terreno/ui` or generated app)

A `DevConsoleLogger` module, no-op unless `__DEV__`:

- Patches `console.error`/`console.warn`, registers `ErrorUtils.setGlobalHandler` (native) and `window.onerror` + `unhandledrejection` (web).
- Batches entries (level, message, stack, timestamp, platform) and POSTs to the backend every few seconds.
- Wired into the bootstrap frontend template's root layout; existing apps add one import.

### Backend (`@terreno/api`)

- `TerrenoApp` auto-registers `POST /__terreno/browser-logs` only when `NODE_ENV === "development"`; appends JSONL to `.terreno/logs/browser.log` (rotation, no auth needed in dev, route 404s in production).

### MCP

- Local tool `browser_logs({ entries: number })` reads the last N entries, exactly like Boost's `browser-logs`.

## Phase 5: Upgrade Prompts

### Upgrade notes as release artifacts

- New directory `mcp-server/src/docs/upgrades/<version>.md` — one note per release that has breaking or notable changes (what changed, codemod-style instructions, before/after snippets).
- Update `.rulesync/skills/release/SKILL.md`: when the release skill flags breaking changes, writing `upgrades/<version>.md` becomes a required step before tagging.

### Prompt and tool

- **Tool `terreno_get_upgrade_guide({ fromVersion, toVersion })`** — concatenates all upgrade notes in the version range (lockstep versioning makes the range unambiguous). Usable by agents without prompt support.
- **Prompt `terreno_upgrade({ targetVersion? })`** — workflow:
  1. Determine current `@terreno/*` versions (local `application_info` or `package.json`).
  2. Call `terreno_get_upgrade_guide` for current → target.
  3. **Backend:** apply note instructions; bump `@terreno/api`, `@terreno/ai`, etc.; run backend tests.
  4. **Frontend/Expo:** install and invoke the official `upgrading-expo` skill (`bunx skills add expo/skills` if not present) for the Expo SDK/dependency portion — `npx expo install expo@latest`, `expo install --fix`, `expo-doctor`, cache clearing, breaking-change checklist. Do not duplicate that content in our notes.
  5. **Terreno frontend:** apply `@terreno/ui` / `@terreno/rtk` note instructions, regenerate the SDK (`generate-sdk` skill), verify with `compile` + lint.
- `terreno_bootstrap_ai_rules` adds a pointer to `expo/skills` in the generated frontend rules so consumer agents discover `upgrading-expo` organically.

## Notifications

None.

## UI

No new UI surfaces. Phase 4 adds the invisible `DevConsoleLogger` to the frontend template.

## Phases & Dependency Order

| Phase | Scope | Depends on |
|-------|-------|------------|
| 1. Docs search tools | `mcp-server` only | — |
| 2. Per-package guidelines | all packages + `mcp-server` | — (parallel with 1) |
| 3. Local stdio server | `mcp-server` packaging, `@terreno/api` logger | publish pipeline change |
| 4. Browser logs | `@terreno/ui`/template, `@terreno/api`, local MCP | 3 |
| 5. Upgrade prompts | `mcp-server`, release skill | 1 (notes searchable), benefits from 3 |

## Feature Flags & Migrations

- No data migrations.
- File logging and the browser-logs endpoint are dev-only by environment check, with `TERRENO_LOG_FILE` / `TERRENO_BROWSER_LOGS` env overrides to disable.
- Publishing `@terreno/mcp` is additive; the hosted Cloud Run deployment is unchanged.

## Risks

- **Read-only enforcement on Mongo** is allowlist-based; `aggregate` stage filtering must be tested against bypass attempts (`$out` nested in `$facet`, etc.).
- **Local server vs. consumer env drift**: reading `.env` directly can miss values injected by other tooling; document `TERRENO_PROJECT_ROOT` and `MONGO_URI` overrides.
- **Doc search quality**: BM25 over chunks is keyword-level, not semantic. Acceptable for v1; the docs-site plan's search index is the upgrade path.
