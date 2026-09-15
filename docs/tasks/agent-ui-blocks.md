# Task List: Agent UI Blocks

**Status:** Draft — blocked on IP approval (`docs/implementationPlans/agent-ui-blocks.md`; D1/D4/D6 confirmed, Q2–Q5 and Q8–Q9 open).
**Supporting skills:** `terreno-ui`, `ai-prompt-governance`, `update-docs`, `verify-ui-changes`, `backend-test-env`, `terreno-backend-api`.

Every task is a vertical slice: contract + renderer or producer + docs + Bun tests. Work
the frontier (blockers complete). Phase 2 chart/table work is additionally blocked on
[PR #1302](https://github.com/FlourishHealth/terreno/pull/1302) merging to `master`.

### Phase 1: Contract — `@terreno/blocks`

- [ ] **Task 1.1**: Package scaffold, Zod schema, parser, structural validation
  - Delivers: `parseBlocks(yamlOrJson)` and `validateBlocks(doc)` reject unknown keys and wrong enums with `{path, code, message, fix}`; `v: 1` required; heading/text/metric/badge/divider/context/columns/card blocks and their enums exist.
  - Files: `blocks/package.json`, `blocks/tsconfig.json`, `blocks/biome.jsonc`, `blocks/src/index.ts`, `blocks/src/schema.ts`, `blocks/src/limits.ts`, `blocks/src/errors.ts`, `blocks/src/parse.ts`, `blocks/src/validate.ts`, `blocks/src/fixtures/valid/*.yaml`, `blocks/src/fixtures/invalid/*.yaml`, `blocks/src/*.test.ts`; root `package.json` (workspace + catalog `yaml`), `knip.jsonc`, `.github/workflows/blocks-ci.yml` (mirror `comms-ci.yml`) or a `blocks` job in `packages-ci.yml`, plus `.circleci` parity if `check:circleci-parity` requires it.
  - Blocked by: none
  - Docs: `docs/reference/blocks.md` (new: grammar tables, limits, error codes), `docs/explanation/agent-ui-blocks.md` (new: why a closed catalog, approaches considered, ownership diagram), `docs/reference/README.md`, `docs/explanation/README.md`.
  - Acceptance: AC1 (golden fixtures for the leaf + layout blocks), AC2 for structural codes (`UNKNOWN_KEY`, `INVALID_ENUM`, `MISSING_REQUIRED`, `UNSUPPORTED_VERSION`, `DEPTH_EXCEEDED`, `TOO_MANY_BLOCKS`); YAML anchors/tags rejected (`YAML_FEATURE_DISALLOWED`); `bun test blocks/` green; `bun run check:knip` green.

- [ ] **Task 1.2**: Datasets, chart and table schema, semantic lint
  - Delivers: `datasets` map with two sources — `inline` (typed columns + rows) and `ref` (`{source: ref, id, grain?, limit?}`, D4/Q6); `chart` (`kind`, `data`/`x`/`y` or `points`) and `table` blocks; lint pass for dataset refs, column existence/type (inline; `ref` columns checked when a `knownDatasets` map is passed, deferred otherwise), row arity, id uniqueness, D7 limits including `ref` `limit` caps, chart heuristics as warnings.
  - Files: `blocks/src/schema.ts`, `blocks/src/lint.ts`, `blocks/src/validate.ts`, `blocks/src/fixtures/**`, `blocks/src/lint.test.ts`, `blocks/src/validate.perf.test.ts`.
  - Blocked by: 1.1
  - Docs: `docs/reference/blocks.md` (dataset sources + chart + table sections, warning codes).
  - Acceptance: AC2 for semantic codes (`DATASET_NOT_FOUND`, `COLUMN_NOT_FOUND`, `COLUMN_TYPE_MISMATCH`, `ROW_ARITY_MISMATCH`, `DUPLICATE_ID`, `DATASET_TOO_LARGE`, `TABLE_TOO_WIDE`, `TOO_MANY_POINTS`) and warnings (`BAR_TOO_MANY_CATEGORIES`, `DONUT_TOO_MANY_SLICES`, `LINE_SINGLE_POINT`); AC18 (`ref` half); AC3 perf test; doc-code parity test reads `docs/reference/blocks.md` and asserts every code in `BLOCK_ERROR_CODES` appears.

- [ ] **Task 1.3**: Actions schema, fence extraction, JSON Schema, prompt section, CLI
  - Delivers: `actions` block with `button`/`segmented` elements and closed `action.kind` set (`reply`, `open`, `select`, `callback`); `validateBlocks(doc, {hostActions?})` emits `UNKNOWN_HOST_ACTION` when an allowlist is supplied; `extractBlockFences(markdown)`; `blocksJsonSchema`; `blocksPromptSection({hostActions})` that embeds the grammar, limits, the `ref` dataset rule ("use the `datasetId` a tool returned; never paste more than 500 rows"), and one example; `terreno-blocks validate` CLI bin.
  - Files: `blocks/src/schema.ts`, `blocks/src/fences.ts`, `blocks/src/jsonSchema.ts`, `blocks/src/prompt.ts`, `blocks/src/cli.ts`, `blocks/package.json` (`bin`), tests.
  - Blocked by: 1.2
  - Docs: `docs/reference/blocks.md` (actions, fence rules, CLI), `docs/how-to/agent-ui-blocks.md` (new: "validate a document locally" section only).
  - Acceptance: AC4 (ajv round-trip on fixtures); fence extraction ignores other fence languages and unterminated fences; `select` with a non-chart/table target → `SELECT_TARGET_INVALID`; CLI exit codes 0/1 asserted via `Bun.spawn`; prompt section snapshot test asserts limits text equals `BLOCK_LIMITS` values (single source of truth).

### Phase 2: Renderer — `@terreno/ui`

- [ ] **Task 2.1**: `BlocksView` for leaf and layout blocks, error and placeholder states
  - Delivers: `BlocksView` (lazy via `heavyOptionalExports`) renders heading/text/metric/badge/divider/context/columns/card with `@terreno/ui` components; string input is validated; invalid → `Banner` + collapsed raw YAML; `columns` stacks on `sm`.
  - Files: `ui/package.json` (`@terreno/blocks` dep), `ui/src/blocks/BlocksView.tsx`, `ui/src/blocks/blockRenderers.tsx`, `ui/src/blocks/BlocksError.tsx`, `ui/src/Common.ts` (`BlocksViewProps`), `ui/src/lazyBoundaries/heavyOptionalExports.tsx`, `ui/src/index.tsx`, `ui/src/blocks/BlocksView.test.tsx`, `demo/stories/BlocksView.stories.tsx`, `demo/story-config/BlocksView.config.tsx`, `demo/demoConfig.tsx`.
  - Blocked by: 1.1
  - Docs: `docs/reference/ui.md` (`BlocksView` section), `docs/explanation/agent-ui-blocks.md` (renderer ownership).
  - Acceptance: AC5 for the covered blocks (plus an `rg` guard test that `ui/src/blocks/` imports no `react-native` `View`/`Text`); AC6; `bun run check:demo-coverage` green; screenshot of the story saved under `/opt/cursor/artifacts/`.

- [ ] **Task 2.2**: Chart and table blocks bound to datasets
  - Delivers: `chart` renders `BarChart`/`LineChart`/`AreaChart`/`DonutChart` inside a `Card` with title, legend, `emptyText`, `height` map (`sm`/`md`/`lg` → px); `table` renders `DataTable` with typed columns (paginated via `more` for `ref` sources); `ref` datasets resolve through the `resolveDataset` prop (`useResolvedDatasets` hook: `loading` state on the chart, error `Banner` on failure, request de-duplicated per `{id, grain, limit, page}`); per-point `color` is not exposed to the agent.
  - Files: `ui/src/blocks/blockRenderers.tsx`, `ui/src/blocks/datasetToPoints.ts`, `ui/src/blocks/useResolvedDatasets.ts`, tests, `demo/stories/BlocksView.stories.tsx` (chart presets incl. a mocked `ref` preset).
  - Blocked by: 1.2, 2.1, PR #1302 merged
  - Docs: `docs/reference/ui.md`, `docs/how-to/charts-and-dashboards.md` (one paragraph: "charts from agent replies").
  - Acceptance: AC5 for chart/table; `datasetToPoints` unit tests (date columns formatted with Luxon, numeric parse, empty dataset → `emptyText`); `useResolvedDatasets` tests (loading → data, rejection → banner, no duplicate fetch); screenshot of bar + donut from one dataset.

- [ ] **Task 2.3**: Actions, `onAction`, segmented dataset switch
  - Delivers: `actions` renders `Button` / `SegmentedControl`; every press calls `onAction({blockId, elementId, messageId, action})`; `select` updates local dataset binding of the target block and still reports; `hostActions` allowlist marks unknown `callback` names as disabled with tooltip; `callback` buttons show `loading` while their id is in `pendingElementIds`; `BlocksView` accepts `overrides: Record<blockId, BlocksDocument>` so a host can replace one block in place (D6 `replace: block`).
  - Files: `ui/src/blocks/BlocksView.tsx`, `ui/src/blocks/useBlockSelections.ts`, `ui/src/Common.ts`, tests, story additions.
  - Blocked by: 1.3, 2.2
  - Docs: `docs/reference/ui.md` (`onAction` payload table, `pendingElementIds`, `overrides`), `docs/explanation/agent-ui-blocks.md` (interaction flow incl. server callbacks).
  - Acceptance: AC8; `onAction` payload snapshot per kind; disabled unknown callback asserted; AC19 (`BlocksView` half: loading + block override).

- [ ] **Task 2.4**: `MarkdownView.fenceRenderers`, `GPTChat` wiring, Blocks Playground
  - Delivers: `MarkdownView` accepts `fenceRenderers`; `GPTChat` renders ` ```terreno-ui ` fences as `BlocksView`, shows a `Spinner` row while a fence is open during streaming, forwards `reply` to `onSubmit`, `open`/`select` to `onBlockAction`, and `callback` to `onBlockCallback?: (action) => Promise<{text?, blocks?, replace?}>` — tracking pending element ids, applying `replace: block` via `overrides`, `replace: message` by swapping the message body, and `text` by appending an assistant message; passes `resolveDataset` through; demo Blocks Playground (YAML `TextArea` → live render + error list, fixture presets).
  - Files: `ui/src/MarkdownView.tsx`, `ui/src/GPTChat.tsx`, `ui/src/GPTChat.test.tsx`, `ui/src/MarkdownView.test.tsx`, `demo/stories/BlocksPlayground.stories.tsx`, `demo/story-config/BlocksPlayground.config.tsx`, `demo/demoConfig.tsx`.
  - Blocked by: 2.3
  - Docs: `docs/reference/ui.md` (`GPTChat.onBlockAction`, `GPTChat.onBlockCallback`, `GPTChat.resolveDataset`, `MarkdownView.fenceRenderers`), `docs/how-to/agent-ui-blocks.md` (playground section).
  - Acceptance: AC7; AC19 (`GPTChat` half); open-fence placeholder test (message content ending mid-fence renders `Spinner`, not raw YAML); playground recording saved under `/opt/cursor/artifacts/`.

### Phase 3: Producer — `@terreno/ai`

- [ ] **Task 3.1**: `uiBlocks` route option, prompt constant, post-stream validation SSE
  - Delivers: `addGptRoutes(router, {uiBlocks: true | {hostActions}})` appends `TERRENO_UI_BLOCKS_SYSTEM_PROMPT` (built from `blocksPromptSection` + host callback names); after `text-delta` stream ends, every fence is validated with `{hostActions: Object.keys(...)}` and SSE `{blocks: {index, ok, errors, warnings}}` is emitted before `{done}`; `AIRequest.metadata.uiBlocks` summary logged.
  - Files: `ai/package.json` (`@terreno/blocks` dep), `ai/src/service/prompts.ts`, `ai/src/routes/gpt.ts`, `ai/src/types/index.ts` (`HostAction`, `UiBlocksOptions`), `ai/src/routes/gpt.test.ts`.
  - Blocked by: 1.3
  - Docs: `docs/reference/ai.md` (option + SSE event row), `docs/how-to/agent-ui-blocks.md` (backend enable section).
  - Acceptance: AC9 with a mock model that streams prose + a valid fence + an invalid fence; AC18 (`UNKNOWN_HOST_ACTION` half); prompt constant lives at the top of `prompts.ts` (ai-prompt-governance); no SSE `blocks` event when `uiBlocks` is off (regression test).

- [ ] **Task 3.4**: `AIDataset` model, `registerAiDataset`, `GET /gpt/datasets/:id`
  - Delivers: `AIDataset` Mongoose model (D18: TTL 7 days, cap 50,000 × 12, `isDeletedPlugin`, descriptions on every field); `registerAiDataset({userId, historyId, columns, rows})` returns `{datasetId, columns, rowCount, preview, stats}` for tool results; `GET /gpt/datasets/:id?grain=&limit=&page=` (`IsOwner`) buckets `date` columns by `grain`, downsamples line/area with LTTB when rows exceed `limit`, paginates tables with `more`; mounted by `addGptRoutes` when `uiBlocks` is on.
  - Files: `ai/src/models/aiDataset.ts`, `ai/src/service/aiDatasets.ts` (`registerAiDataset`, `bucketByGrain`, `lttb`), `ai/src/routes/gptDatasets.ts`, `ai/src/routes/gpt.ts` (mount), `ai/src/types/index.ts`, `ai/src/index.ts`, `ai/src/service/aiDatasets.test.ts`, `ai/src/routes/gptDatasets.test.ts`.
  - Blocked by: 1.2
  - Docs: `docs/reference/ai.md` (model + route + helper rows), `docs/explanation/agent-ui-blocks.md` ("why rows never pass through the model"), `docs/how-to/agent-ui-blocks.md` ("return a dataset from a tool").
  - Acceptance: AC16; `lttb` property test (output length ≤ `limit`, first/last points preserved); mongoose-schema-safety checklist applied (new model, additive only).

- [ ] **Task 3.5**: `POST /gpt/actions` host callback route
  - Delivers: `POST /gpt/actions` (D19) validates `{historyId, messageId, blockId, elementId, name, payload}`, looks up `hostActions[name]`, validates `payload` against its Zod schema, checks history ownership, runs `handler({payload, user, history, blockId, elementId})` with a 10 s timeout, validates any returned `blocks` with `validateBlocks`, returns `{text?, blocks?, replace?}`, logs `AIRequest` `requestType: "ui_action"`; shares the `/gpt` rate-limit bucket.
  - Files: `ai/src/routes/gptActions.ts`, `ai/src/routes/gpt.ts` (mount), `ai/src/types/index.ts`, `ai/src/routes/gptActions.test.ts`, `ai/src/models/aiRequest.ts` (`requestType` enum additions).
  - Blocked by: 3.1
  - Docs: `docs/reference/ai.md` (route row + `HostAction` type), `docs/how-to/agent-ui-blocks.md` ("register a server callback"), `docs/explanation/agent-ui-blocks.md` (Block Kit `block_actions` comparison table).
  - Acceptance: AC17; handler timeout returns 504 and is logged; returned invalid `blocks` → 500 with error list (host bug, not agent bug).

- [ ] **Task 3.2**: `AIService.generateBlocks` with bounded repair
  - Delivers: `generateBlocks({prompt, systemPrompt?, userId?, repair?})` → `Output.object(blocksJsonSchema)` → `validateBlocks`; one repair retry on failure with errors appended to the prompt; `requestType: "ui_blocks"`; throws `APIError 422` with the error list after the retry fails.
  - Files: `ai/src/service/aiService.ts`, `ai/src/types/index.ts`, `ai/src/service/aiService.test.ts`.
  - Blocked by: 3.1
  - Docs: `docs/reference/ai.md` (method table row + temperature preset note).
  - Acceptance: AC10; deterministic temperature asserted; logged `metadata.errorCodes` on failure.

- [ ] **Task 3.3**: MCP validator tool
  - Delivers: `terreno_validate_ui_blocks({document})` returns the CLI report text; listed in `ListTools`.
  - Files: `mcp-server/package.json` (`@terreno/blocks` dep), `mcp-server/src/tools.ts`, `mcp-server/src/tools.test.ts`.
  - Blocked by: 1.3
  - Docs: `docs/reference/mcp-server.md` (tool row), `.cursor/rules/mcp-server/00-mcp-server.mdc` via rulesync source `.rulesync/rules/mcp-server/00-mcp-server.md`.
  - Acceptance: AC11; tool schema snapshot.

### Phase 4: Examples, e2e, docs

- [ ] **Task 4.1**: example-frontend AI tab renders blocks and handles actions
  - Delivers: `ai.tsx` handles SSE `blocks` event (attaches validation summary to the message for a subtle "n components" caption), passes `onBlockAction` (`open` → `router.push` for `/…` routes or `Linking.openURL` for https), `onBlockCallback` → generated `usePostGptActionsMutation`, `resolveDataset` → generated `useLazyGetGptDatasetsByIdQuery` (SDK regenerated via `bun run sdk`), `reply` flows through existing `onSubmit`; e2e mock streams a fence with one inline and one `ref` dataset and serves the dataset + action routes.
  - Files: `example-frontend/app/(tabs)/ai.tsx`, `example-frontend/store/openApiSdk.ts` (generated), `example-frontend/e2e/helpers/mockGpt.ts`, `example-frontend/e2e/ai-chat.spec.ts`.
  - Blocked by: 2.4, 3.1, 3.4, 3.5
  - Docs: `docs/how-to/agent-ui-blocks.md` (frontend wiring section), `docs/explanation/example-coverage.md` (capability row).
  - Acceptance: AC13; recording of prompt → bar chart (from `ref`) → callback button loading → block replaced → follow-up `reply` button → new user message, saved under `/opt/cursor/artifacts/`.

- [ ] **Task 4.2**: example-backend enable, changelog, docs sweep
  - Delivers: `example-backend` passes `uiBlocks: {hostActions: {exportDataset: {payload, handler}}}` with a handler that returns `{replace: "block", blocks}`; a `todoStats` tool calls `registerAiDataset` so a real prompt produces a `ref` chart; changelog entry; all reference/how-to/explanation pages cross-linked; rules regenerated.
  - Files: `example-backend/src/server.ts`, `example-backend/src/ai/hostActions.ts`, `example-backend/src/ai/tools.ts`, `changelog/unreleased/agent-ui-blocks.md`, `docs/how-to/README.md`, `docs/reference/README.md`, `docs/explanation/README.md`, `.rulesync/rules/ui/00-ui.md` (BlocksView bullet) → `bun run rules`.
  - Blocked by: 4.1, 3.2, 3.3
  - Docs: as listed.
  - Acceptance: AC14, AC15; `bun run website:build` green; `bun run rules:check` green.
