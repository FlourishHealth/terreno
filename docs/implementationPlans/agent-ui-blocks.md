# Agent UI Blocks — a strict YAML DSL for agent-rendered Terreno components

**Status:** Draft — awaiting approval (Grow ran unattended; every Decisions row marked `assumed` is a recommended default, not a confirmed choice)  
**Branch:** `cursor/agent-ui-blocks-grow-e5c0`  
**Owner:** unassigned  
**Created:** 2026-09-15  
**Task list:** [`docs/tasks/agent-ui-blocks.md`](../tasks/agent-ui-blocks.md)  
**Linear:** none  
**Roadmap issue:** none yet (handoff after Approved)  
**Related:** [`charts-and-dashboards.md`](./charts-and-dashboards.md) (PR #1302 — chart components this DSL targets), [`ai-observability.md`](./ai-observability.md), [`app-mcp-server.md`](./app-mcp-server.md)  
**Primary packages:** new `@terreno/blocks` (contract), `@terreno/ui` (renderer), `@terreno/ai` (prompting + validation), `@terreno/mcp` (validator tool), `demo`, `example-frontend`, `example-backend`

## Goal

Let an agent answer with **components, not just prose**. An assistant reply may contain
one or more fenced `terreno-ui` YAML documents. Each document is a short, ordered list of
**blocks** (heading, text, metric, chart, table, actions, columns, card, …) plus named
**datasets** that charts and tables bind to. Terreno owns the grammar, the validator, and
the renderer, so the agent can only ever produce `@terreno/ui` components painted from
the app theme — never HTML, JSX, or hex colors.

The grammar is deliberately **strict and small** so an agent can check its own work in
milliseconds: unknown keys, missing dataset columns, a non-numeric `y`, more than 50
blocks, or a donut with 20 slices all fail with a path, a code, and a one-line fix. The
same pure validator runs on the backend after the stream ends, in the MCP server, in the
demo playground, and in the renderer.

Charting is the headline use case: "show me signups by month" becomes a `chart` block
bound to an inline dataset, rendered by the `BarChart` / `LineChart` / `AreaChart` /
`DonutChart` components from [PR #1302](https://github.com/FlourishHealth/terreno/pull/1302).

## Non-Goals

- Arbitrary component trees. The agent picks from a closed catalog with a depth cap of 2.
- Free-form styling. No hex colors, pixel padding, fonts, or `style` objects — only the
  theme tokens `@terreno/ui` already exposes (`color: primary`, `size: lg`, …).
- Forms and data entry (`TextField`, `DateTimeField`, file upload). v1 interaction is
  buttons, a segmented dataset switch, table row press, and chart tooltips.
- Client-side data fetching or SQL. Datasets are inline values the agent already has (or
  a tool returned). Live-query datasets are future work.
- Progressive rendering of a half-streamed document. v1 renders when the fence closes and
  shows a placeholder while it is open.
- Multi-series, stacked, or combo charts, zoom, brush. These depend on the chart
  components; the schema reserves room (`series`) but v1 rejects it.
- Replacing `MarkdownView`, tool-call cards, or image/file `contentParts` in `GPTChat`.
- Slack, A2UI, or json-render wire compatibility. Adapters can come later; v1 owns its
  own format (see Decisions D1).

## Approaches considered

The request asked for multiple options. Four were evaluated against: strictness,
checkability, LLM error rate, chart fit, human readability, and Terreno ownership.

| # | Approach | Shape | Strengths | Costs | Verdict |
| --- | --- | --- | --- | --- | --- |
| A | **Terreno-owned block list + datasets** (Slack Block Kit shape, dbt Charts data binding) | Ordered `blocks:` (depth ≤ 2) + named `datasets:`; YAML in a `terreno-ui` fence | Smallest grammar that covers charts + text + actions; reads like the rendered output; one Zod schema → JSON Schema → prompt; flat enough that LLM edits are local; Terreno owns evolution | We write parser, lint, renderer (~1.5k LOC + tests); no streaming patches in v1 | **Recommended** |
| B | **Adopt Vercel `json-render`** (`@json-render/core` + `@json-render/yaml` + `@json-render/react-native`) with a Terreno catalog | Flat adjacency list `root:` + `elements: {id: {type, props, children}}`; ` ```yaml-spec ` fences; Zod catalog | Streaming patches, devtools, MCP Apps, RN renderer exist today; we only write the catalog | Pre-1.0 (200+ releases since Jan 2026) on the lockstep dependency path; adjacency list is hard for humans to read and for LLMs to keep consistent (dangling ids); RN-web support unverified; styling model is theirs; dataset/chart binding must be bolted on as custom props | Rejected for v1; keep an adapter in mind (D1) |
| C | **Chart grammar only** (dbt Charts style: `queries` + `charts` + `rows`) | Datasets + chart encodings + row/col layout; text limited to titles | Extremely strict; best chart lint story; tiny prompt | Cannot express metric cards, badges, follow-up buttons, or tables without inventing a second grammar later | Folded into A as the `datasets` + `chart` block |
| D | **Pure Block Kit clone** (flat `blocks:` array, no nesting, `block_id`/`action_id`, `blocks.validate`) | Section / context / actions / divider / header / table blocks | Proven with LLMs (Slack's Block Kit skill); trivially checkable; interaction payload model is well understood | No first-class data or chart model; `mrkdwn` vs markdown split is Slack-specific; 1-level flat makes side-by-side charts impossible | Folded into A: same block/`id` discipline, plus `columns`/`card` for depth 2 |

Option A keeps the parts of B, C, and D that matter — Zod catalog and prompt generation
(B), inline datasets with column-typed encodings and visualization lint (C), ordered block
list with ids, caps, and a `validate` call (D) — without importing a moving dependency.

## Decisions

| ID | Question | Decision | Status |
| --- | --- | --- | --- |
| D1 | Own the grammar or adopt json-render / A2UI? | Own it (Approach A). Ship the contract as a tiny dependency-free-ish package so an adapter to json-render or A2UI can be added later without touching the renderer. | assumed |
| D2 | Wire format on the model side? | YAML inside a fenced ` ```terreno-ui ` block in the normal markdown reply, interleaved with prose. The parser also accepts JSON (YAML superset), which is what the structured-output path emits. Whole-reply-is-YAML is rejected: it kills interleaving and streaming of prose. | assumed |
| D3 | Nested tree or flat adjacency list? | Nested, depth-capped at 2 (`blocks` → `columns`/`card` → leaf). Nested YAML mirrors the rendered layout and is what humans review; the depth cap keeps LLM error rates near flat-list levels. Ids are optional except on interactive blocks and elements. | assumed |
| D4 | Where does chart/table data live? | In a top-level `datasets:` map: `columns: [{name, type: string\|number\|date}]` plus `rows: [[...]]`. Charts and tables reference `data: <name>` and column names (`x`, `y`, `columns`). One dataset can feed a chart and a table; lint checks refs and types. Per-chart inline `points` is also accepted for one-off charts. | assumed |
| D5 | v1 block catalog? | `heading`, `text` (markdown), `metric`, `badge`, `divider`, `context`, `chart` (`kind: line\|bar\|area\|donut`), `table`, `actions`, `columns` (2–4 children), `card`. Maps 1:1 onto `Heading`, `MarkdownView`, `Text`+`Heading`, `Badge`, `SectionDivider`, `Text size=sm color=secondaryLight`, chart components, `DataTable`, `Button`/`SegmentedControl`, `Box direction=row`, `Card`. | assumed |
| D6 | Interaction model? | Elements carry an `action` with a closed `kind`: `reply` (post `text` to the chat as the user's next message), `open` (`url` or app `route`; host may allowlist), `select` (client-local: switch a target chart/table's `data` to another dataset), `callback` (`name` + `payload`, host-registered). The renderer emits one `onAction({blockId, elementId, action})`; it never executes code from the document. | assumed |
| D7 | Hard limits (strict mode)? | Unknown keys fail. ≤ 50 blocks total, depth ≤ 2, ≤ 25 elements per `actions`, ≤ 4 columns, ≤ 8 datasets, ≤ 500 rows × 12 columns per dataset, ≤ 8 donut slices, ≤ 60 x-categories, text ≤ 4,000 chars per block, ≤ 20,000 chars per document. Same numbers everywhere (schema, prompt, docs). | assumed |
| D8 | Where does the contract live? | New workspace package `blocks/` → `@terreno/blocks` (schema, parse, validate, lint, JSON Schema, prompt section, fence extraction). Deps: `zod` (catalog) and `yaml` (already in `api`). No React, no Express. `@terreno/ui`, `@terreno/ai`, `@terreno/mcp` depend on it. | assumed |
| D9 | Styling vocabulary exposed to the agent? | Only semantic enums already on `@terreno/ui` props: `Text`/`Heading` `size`, `Badge` `status`, `Button` `variant`, `metric.trend: up\|down\|flat`, `Box` `color` surface names. No numbers for spacing, no hex. | assumed |
| D10 | Rendering while streaming? | Render on fence close. While the fence is open, `GPTChat` shows a `Spinner` row labelled "Rendering…". Invalid documents render a compact error `Banner` listing the first three errors and collapse the raw YAML behind an `Accordion`; the chat never crashes (wrapped in `ErrorBoundary`). | assumed |
| D11 | How does the agent check its work? | Three surfaces, one function: (1) `validateBlocks()` runs on the backend when a fence closes and emits SSE `{blocks: {index, ok, errors}}` so the model's next turn (or an automatic single repair pass) sees exact errors; (2) MCP tool `terreno_validate_ui_blocks`; (3) `AIService.generateBlocks()` uses `Output.object(schema)` then `validateBlocks()` with one bounded repair retry. Optional CLI `terreno-blocks validate <file>` ships with the package. | assumed |
| D12 | Error shape? | `{path: "blocks[3].y", code: "COLUMN_NOT_FOUND", message, fix}` sorted by path; codes are a closed enum documented in the reference page; `fix` is one imperative sentence (dbt Charts style). Lint warnings use the same shape with `severity: warning` and never block rendering. | assumed |
| D13 | Version field? | Required `v: 1` at the top. Unknown major → `UNSUPPORTED_VERSION`. Additive changes stay in v1; removals bump. | assumed |
| D14 | Where is it demonstrated first? | `demo` gets a `BlocksView` story and a **Blocks Playground** (YAML editor → live render + error list, the Block Kit Builder analog). `example-frontend` AI tab turns on `uiBlocks` and handles `reply`/`open`. `example-backend` passes `uiBlocks: true` to `addGptRoutes`. | assumed |
| D15 | Dependency on PR #1302 charts? | `chart` block lands after #1302 merges and targets its single-series `{label, value}[]` API exactly. Multi-series stays rejected by the schema until the chart components grow it. | assumed |
| D16 | Multi-fence documents per message? | Allowed. Each fence is independent (own `v`, own datasets). Cross-fence dataset references are an error. | assumed |

## Architecture

```
                                   MODEL
   system prompt  ◄── blocksPromptSection(catalog, limits)  ── @terreno/blocks
        │
        ▼  markdown + ```terreno-ui fences (YAML)          (or Output.object(schema) JSON)
   @terreno/ai  /gpt/prompt  ── streams text-delta SSE ──────────────────────┐
        │  on fence close: extractBlockFences → parseBlocks → validateBlocks │
        │  emits SSE {blocks: {index, ok, errors[]}}  + AIRequest.metadata   │
        ▼                                                                    ▼
   @terreno/ui  GPTChat ── MarkdownView(fenceRenderers) ── BlocksView(doc, onAction)
                                                            │
                          Heading · MarkdownView · Badge · DataTable · Card · Box
                          BarChart · LineChart · AreaChart · DonutChart (#1302)
                          Button · SegmentedControl  ──►  onAction({blockId, elementId, action})
                                                            │
                          host: reply → onSubmit(text) · open → router · callback → app handler
```

Layers and ownership:

| Layer | Package | Owns |
| --- | --- | --- |
| Contract | `@terreno/blocks` | Zod schema (`strict()`), `parseBlocks`, `validateBlocks` (structure + semantic lint), `blocksJsonSchema`, `blocksPromptSection`, `extractBlockFences`, error codes, limits, fixtures |
| Renderer | `@terreno/ui` | `BlocksView` (lazy, `heavyOptionalExports`), `MarkdownView.fenceRenderers`, `GPTChat.onBlockAction`, error/placeholder states |
| Producer | `@terreno/ai` | `TERRENO_UI_BLOCKS_SYSTEM_PROMPT`, `addGptRoutes({uiBlocks})`, post-stream validation SSE, `AIService.generateBlocks`, repair pass, request logging |
| Tooling | `@terreno/mcp`, `blocks/bin` | `terreno_validate_ui_blocks` tool, `terreno-blocks validate` CLI |
| Proof | `demo`, `example-*` | Stories, playground, AI tab wiring, e2e mock |

### The grammar (v1)

```yaml
v: 1
datasets:
  signups:
    columns:
      - {name: month, type: string}
      - {name: count, type: number}
    rows:
      - [Jan, 120]
      - [Feb, 145]
      - [Mar, 138]
blocks:
  - type: heading
    text: Signups this quarter
    size: lg
  - type: columns
    children:
      - type: metric
        label: Total
        value: "403"
        delta: "+12%"
        trend: up
      - type: metric
        label: Best month
        value: Feb
  - type: chart
    id: signups_chart
    kind: bar
    data: signups
    x: month
    y: count
    title: Signups by month
  - type: table
    data: signups
    columns: [month, count]
  - type: actions
    id: followups
    elements:
      - type: button
        id: weekly
        text: Show weekly
        action: {kind: reply, text: Show weekly signups for this quarter}
      - type: button
        id: export
        text: Export CSV
        variant: outline
        action: {kind: callback, name: exportDataset, payload: {dataset: signups}}
```

Block reference (full field tables live in `docs/reference/blocks.md`):

| Block | Required | Optional | Renders |
| --- | --- | --- | --- |
| `heading` | `text` | `size` | `Heading` |
| `text` | `markdown` | — | `MarkdownView` |
| `metric` | `label`, `value` | `delta`, `trend`, `helper` | `Card` with `Text`+`Heading` |
| `badge` | `text` | `status` | `Badge` |
| `divider` | — | — | `SectionDivider` |
| `context` | `text` | — | `Text size=sm color=secondaryLight` |
| `chart` | `kind`, (`data`+`x`+`y`) or `points` | `id`, `title`, `legend`, `emptyText`, `height: sm\|md\|lg` | `BarChart` / `LineChart` / `AreaChart` / `DonutChart` in `Card` |
| `table` | `data` | `id`, `columns`, `title`, `rowAction` | `DataTable` |
| `actions` | `id`, `elements` | — | `Box direction=row wrap` of `Button` / `SegmentedControl` |
| `columns` | `children` (2–4 blocks) | — | `Box direction=row`, stacks on `sm` |
| `card` | `children` | `title` | `Card` |

Element reference: `button {id, text, action, variant?, iconName?}`,
`segmented {id, target, options: [{label, data}]}` (client-local dataset switch).

### Validation pipeline

1. `extractBlockFences(markdown)` → `[{index, raw, start, end}]` (only ` ```terreno-ui ` fences).
2. `parseBlocks(raw)` → YAML (or JSON) → plain object; YAML anchors/tags rejected
   (`schema: "core"`, `uniqueKeys: true`, no custom tags).
3. Zod `strict()` structural pass → all structural errors at once, not first-failure.
4. Semantic lint pass: dataset refs, column existence and type (`y` numeric, `x`
   string/date), row arity, id uniqueness, `select` targets exist and are charts/tables,
   limits from D7, chart heuristics (`BAR_TOO_MANY_CATEGORIES` > 60, `DONUT_TOO_MANY_SLICES`
   > 8, `LINE_SINGLE_POINT`, `TABLE_TOO_WIDE` > 12 columns).
5. Result: `{ok: true, doc, warnings}` or `{ok: false, errors, warnings}`. Pure, sync,
   no I/O, target < 5 ms for a 50-block document (asserted in a test).

### Interaction flow

`BlocksView` is controlled and side-effect free. Every element press calls
`onAction({blockId, elementId, action})`. Hosts decide:

| `action.kind` | `GPTChat` default | `example-frontend` |
| --- | --- | --- |
| `reply` | calls `onSubmit(action.text)` | same |
| `open` | calls `onBlockAction`; no default navigation | `router.push(route)` or `Linking.openURL(url)` after allowlist |
| `select` | handled inside `BlocksView` (local state), then reported | reported only |
| `callback` | calls `onBlockAction` | app handler map by `name` |

## Models

None. `AIRequest.metadata` gains `uiBlocks: {fences, valid, invalid, errorCodes[]}` for
observability; no schema change (Mixed).

## APIs

| Surface | Change |
| --- | --- |
| `addGptRoutes(router, {aiService, openApiOptions, uiBlocks?: boolean \| {hostActions?: string[]}})` | When enabled, appends `TERRENO_UI_BLOCKS_SYSTEM_PROMPT` (with host `callback` names) to the effective system prompt; after the text stream ends, validates every fence and emits SSE `{blocks: {index, ok, errors, warnings}}` before `{done}`. |
| `AIService.generateBlocks({prompt, systemPrompt?, userId?, repair?: boolean})` | `Output.object(blocksJsonSchema)` → `validateBlocks`; on failure and `repair !== false`, one retry with errors appended; logs `requestType: "ui_blocks"`. |
| `@terreno/blocks` exports | `parseBlocks`, `validateBlocks`, `extractBlockFences`, `blocksSchema` (Zod), `blocksJsonSchema`, `blocksPromptSection`, `BLOCK_LIMITS`, `BLOCK_ERROR_CODES`, types. |
| MCP | `terreno_validate_ui_blocks({document: string})` → text report identical to CLI output. |
| CLI | `terreno-blocks validate <file\|->` exit 0/1, prints errors as `path  CODE  message — fix`. |

## UI

| Component | Package | Notes |
| --- | --- | --- |
| `BlocksView` | `@terreno/ui` (lazy) | Props: `document: string \| BlocksDocument`, `onAction?`, `hostActions?`, `testID?`. Validates when given a string; renders error `Banner` + collapsed raw when invalid. |
| `MarkdownView.fenceRenderers` | `@terreno/ui` | `Record<lang, (code: string) => ReactNode>`; unknown langs keep current fence styling. |
| `GPTChat.onBlockAction` | `@terreno/ui` | Wires `fenceRenderers["terreno-ui"]` → `BlocksView`; `reply` → `onSubmit`; open fences → placeholder `Spinner` row. |
| Blocks Playground | `demo` | Story with `TextArea` (YAML) → live `BlocksView` + error list; ships the golden fixtures as presets. |

## Phases

| Phase | Slice | Proves |
| --- | --- | --- |
| 1 | `@terreno/blocks` contract: schema, parse, validate, lint, JSON Schema, prompt, fences, CLI | Golden fixtures: every valid fixture parses; every invalid fixture yields the expected code at the expected path; < 5 ms |
| 2 | `@terreno/ui` renderer: leaf blocks → chart/table → layout + actions → `GPTChat` wiring + playground | Bun tests per block; demo screenshots; playground video |
| 3 | `@terreno/ai` producer: `uiBlocks` route option, validation SSE, `generateBlocks`, repair | supertest with mock model emitting fences; SSE `blocks` event asserted; repair retry asserted |
| 4 | Tooling + examples + docs: MCP tool, example-frontend AI tab, example-backend option, how-to | e2e `ai-chat.spec.ts` renders a chart from mocked SSE; MCP tool test |

## Feature Flags & Migrations

None. `uiBlocks` is off unless the consumer passes it. No data migration.

## Not Included / Future Work

- Progressive rendering via streaming YAML patches (json-render `@json-render/yaml`
  style) once the fence-close path is stable.
- Live datasets (`data: {source: tool, name}`) and pagination for large tables.
- Multi-series / stacked charts when #1302 grows them.
- Form elements (`select`, `date`, `text input`) with a `submit` action.
- Adapters: emit A2UI or json-render specs from a validated `BlocksDocument`.
- Admin AI playground rendering blocks in the observability screens (#1196).

## Files to Create / Modify

| Package | Files |
| --- | --- |
| `blocks/` (new) | `package.json`, `tsconfig.json`, `biome.jsonc`, `src/index.ts`, `src/schema.ts`, `src/limits.ts`, `src/errors.ts`, `src/parse.ts`, `src/validate.ts`, `src/lint.ts`, `src/fences.ts`, `src/prompt.ts`, `src/jsonSchema.ts`, `src/cli.ts`, `src/fixtures/valid/*.yaml`, `src/fixtures/invalid/*.yaml`, `*.test.ts` |
| `ui/` | `src/blocks/BlocksView.tsx`, `src/blocks/blockRenderers.tsx`, `src/blocks/BlocksError.tsx`, `src/MarkdownView.tsx` (`fenceRenderers`), `src/GPTChat.tsx` (`onBlockAction`, placeholder), `src/lazyBoundaries/heavyOptionalExports.tsx`, `src/index.tsx`, `src/Common.ts` (props), tests |
| `ai/` | `src/service/prompts.ts` (`TERRENO_UI_BLOCKS_SYSTEM_PROMPT`), `src/service/aiService.ts` (`generateBlocks`), `src/routes/gpt.ts` (`uiBlocks`, SSE `blocks`), `src/types/index.ts`, tests |
| `mcp-server/` | `src/tools.ts` (`terreno_validate_ui_blocks`), test |
| `demo/` | `stories/BlocksView.stories.tsx`, `story-config/BlocksView.config.tsx`, `stories/BlocksPlayground.stories.tsx`, `demoConfig.tsx` |
| `example-frontend/` | `app/(tabs)/ai.tsx`, `e2e/helpers/mockGpt.ts`, `e2e/ai-chat.spec.ts` |
| `example-backend/` | `src/server.ts` (`uiBlocks: true`) |
| root | `package.json` (workspace `blocks`, catalog `yaml`), `knip.jsonc`, `.github/workflows` (blocks CI), `changelog/unreleased/agent-ui-blocks.md` |
| docs | `docs/explanation/agent-ui-blocks.md` (new), `docs/reference/blocks.md` (new), `docs/how-to/agent-ui-blocks.md` (new), `docs/reference/ui.md`, `docs/reference/ai.md`, `docs/reference/mcp-server.md`, `docs/explanation/README.md`, `docs/reference/README.md`, `docs/how-to/README.md` |

## Task List

[`docs/tasks/agent-ui-blocks.md`](../tasks/agent-ui-blocks.md)

## Acceptance Criteria

| # | Criterion | Verification |
| --- | --- | --- |
| AC1 | Every fixture under `blocks/src/fixtures/valid/` validates with zero errors; every fixture under `invalid/` fails with exactly the expected `{path, code}` pairs | `bun test blocks/` golden test |
| AC2 | Unknown keys, wrong enum values, missing dataset/column refs, and each D7 limit produce a distinct documented error code | `blocks/src/validate.test.ts` one case per code; `docs/reference/blocks.md` lists the same codes (doc-code parity test) |
| AC3 | `validateBlocks` on a 50-block, 8-dataset document completes in < 5 ms median | `blocks/src/validate.perf.test.ts` |
| AC4 | `blocksJsonSchema` accepts and rejects the same fixtures as the Zod schema | round-trip test using `ajv` (dev dependency) |
| AC5 | `BlocksView` renders every v1 block type with `@terreno/ui` components only; no raw `View`/`Text` in `ui/src/blocks/` | `BlocksView.test.tsx` per block + `rg` guard test |
| AC6 | Invalid document → error `Banner` with first three errors, raw YAML in a collapsed `Accordion`, no throw | `BlocksView.test.tsx` |
| AC7 | Pressing a `reply` button in `GPTChat` calls `onSubmit(text)`; `callback`/`open` reach `onBlockAction` with `{blockId, elementId, action}` | `GPTChat.test.tsx` |
| AC8 | `segmented` element switches the target chart's dataset locally and reports `select` | `BlocksView.test.tsx` |
| AC9 | `/gpt/prompt` with `uiBlocks: true` appends the blocks prompt section and emits SSE `{blocks: {index, ok, errors}}` for each fence before `{done}` | `ai/src/routes/gpt.test.ts` with a mock model that streams a fence |
| AC10 | `AIService.generateBlocks` returns a validated document; an invalid first attempt triggers exactly one repair call whose prompt includes the error codes | `aiService.test.ts` mock `doGenerate` sequence |
| AC11 | MCP `terreno_validate_ui_blocks` returns the same report text as the CLI for the same input | `mcp-server` tool test + `blocks/src/cli.test.ts` |
| AC12 | Demo: `BlocksView` story and Blocks Playground registered; `bun run check:demo-coverage` passes | CI + screenshots under `/opt/cursor/artifacts/` |
| AC13 | example-frontend AI tab renders a bar chart from a mocked SSE reply containing a `terreno-ui` fence and a follow-up button sends a reply | `example-frontend/e2e/ai-chat.spec.ts` + recording |
| AC14 | Docs: explanation, reference, how-to pages exist and are linked from their READMEs; `docs/reference/ai.md`, `ui.md`, `mcp-server.md` updated | `bun run website:build` + reviewer read |
| AC15 | `bun run prepush` green (lint, knip, no-barrel-imports, source rules, demo coverage) | CI |
