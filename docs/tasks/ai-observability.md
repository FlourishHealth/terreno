# Tasks: AI observability (Langfuse-light)

IP: [ai-observability](../implementationPlans/ai-observability.md)

Supporting skills (every task as applicable): `mongoose-schema-safety`, `terreno-backend-api`, `backend-test-env`, `ai-prompt-governance`, `update-docs`, `generate-sdk`, `verify-ui-changes`, `terreno-ui`, `terreno-data-fetching`, `building-terreno-apps`.

## Phase 1 — Contracts and tracer

- [ ] **Task 1.1**: Observability types + `ObservabilityApp` config validation
  - Delivers: `ObservabilityPlugin` / sinks / `ObservabilityControlConfig`; boot throws on `experiments.primary !== datasets.primary` or `reviewQueue` ≠ `local`; throws if a primary’s plugin is missing
  - Files: `ai/src/observability/types.ts`, `ai/src/observability/observabilityApp.ts`, `ai/src/observability/observabilityApp.test.ts`, `ai/src/index.ts`
  - Blocked by: none
  - Docs: `docs/explanation/ai-observability.md` (two planes + config errors; already stubbed in Grow)
  - Acceptance: unit tests for valid local-only, both plugins + defaults, illegal mix, langfuse reviewQueue, local-off + prompts primary local

- [ ] **Task 1.2**: In-memory TraceSink/ScoreSink + `AIService` emit + production prompt resolve
  - Delivers: every `generate*` exports a trace unless `skipTrace`; sink failures logged not thrown; `AIRequest` still written; `userId`/`sessionId`/`promptRef`/`priceMap` on options; `promptName`+`promptLabel` resolves via PromptRegistry (stub registry ok in this task)
  - Files: `ai/src/observability/memorySinks.ts`, `ai/src/service/aiService.ts`, `ai/src/types/index.ts`, `ai/src/service/aiService.test.ts`
  - Blocked by: 1.1
  - Docs: `docs/reference/ai.md` — `skipTrace`, `promptName`, `promptLabel`, `promptRef`, usage/cost fields
  - Acceptance: tests: emit; skipTrace; throwing sink; costUsd from price map; missing model → no usd; multi-step still logs AIRequest; missing production label → 400 and no generate; resolved body used when registry returns a version

- [ ] **Task 1.3**: GPT routes pass identity
  - Delivers: `/gpt/prompt` sets `userId` from `req.user` and `sessionId` from body/header `x-ai-session-id` into `AIService`
  - Files: `ai/src/routes/gpt.ts`, `ai/src/routes/gpt.test.ts` (or existing route tests)
  - Blocked by: 1.2
  - Docs: `docs/reference/ai.md` GPT section
  - Acceptance: authenticated prompt produces a memory sink trace with that userId

## Phase 2 — Local telemetry + prompts

- [ ] **Task 2.1**: Local Mongo models for prompts + traces + spans + scores
  - Delivers: schemas with descriptions, plugins, indexes from the IP; models registered only when local plugin constructs
  - Files: `ai/src/observability/local/models/*.ts`, `ai/src/observability/local/types.ts`, model tests
  - Blocked by: 1.1
  - Docs: `docs/reference/ai.md` model tables
  - Acceptance: save/load version immutability; unique `(promptId, label)`; findExactlyOne/findOneOrNone only

- [ ] **Task 2.2**: Local `PromptRegistry` + prompt HTTP
  - Delivers: create named prompt, immutable versions, move production/latest, compile `{{vars}}`, get by label
  - Files: `ai/src/observability/local/promptStore.ts`, `ai/src/observability/routes/prompts.ts`, tests
  - Blocked by: 2.1, 1.1
  - Docs: `docs/how-to/observe-llm-calls.md` — create + pin production
  - Acceptance: v1 unchanged after v2; get production returns v2; playground compile without new version

- [ ] **Task 2.3**: Local `TraceSink`/`ScoreSink` + trace/session/user/cost HTTP
  - Delivers: persist fan-in from ObservabilityApp; list/detail/filters; cost aggregates
  - Files: `ai/src/observability/local/traceStore.ts`, `ai/src/observability/routes/traces.ts`, tests
  - Blocked by: 2.1, 1.2
  - Docs: `docs/reference/ai.md` routes
  - Acceptance: filter user/session/prompt/minCost; nested spans round-trip; costs by model

## Phase 3 — Evaluators, live sample, review

- [ ] **Task 3.1**: Evaluator model + LLM-judge + code/json-assert + SOP templates
  - Delivers: multidimensional scores with optional `confidence`; judge prompt from PromptRegistry production (or named constant in `prompts.ts` for the built-in judge wrapper); structured JSON via `generateJsonObject`; `GET /evaluators/templates` for correctness, hallucination, helpfulness, toxicity, conciseness
  - Files: `ai/src/observability/local/evaluatorStore.ts`, `ai/src/observability/evaluate.ts`, `ai/src/observability/evaluatorTemplates.ts`, `ai/src/service/prompts.ts` (judge wrapper constant), tests
  - Blocked by: 2.2, 2.3
  - Docs: explanation — dimensions; how-to `ai-feature-development.md` step 4
  - Acceptance: numeric + boolean dimensions on one trace; judge parse failure records error score not throw to caller; templates installable by name; `confidenceAlertBelow` defaults 0.7

- [ ] **Task 3.2**: `sampleRate` live evals via BackgroundTask
  - Delivers: default 0; >0 enqueues eval after trace export; still never throws from generate
  - Files: `ai/src/observability/liveEval.ts`, `observabilityApp.ts`, tests
  - Blocked by: 3.1
  - Docs: how-to env `AI_OBS_SAMPLE_RATE`
  - Acceptance: rate 0 → no task; rate 1 → BackgroundTask created (mock/stub runner ok)

- [ ] **Task 3.3**: Local review queue API
  - Delivers: enqueue from trace; list pending; submit scores; skip; assign; `reason` includes `dataset_candidate` / `feedback`
  - Files: `ai/src/observability/local/reviewStore.ts`, `ai/src/observability/routes/review.ts`, tests
  - Blocked by: 3.1
  - Docs: how-to — review flow
  - Acceptance: submit writes ScoreSink fan-out path; done item not in pending

- [ ] **Task 3.4**: Authenticated trace feedback
  - Delivers: `POST /traces/:id/feedback` thumbs / outcome / flagDataset; ScoreSink `source: "user-feedback"`; owner or admin; sets `flaggedForDataset`; optional review enqueue
  - Files: `ai/src/observability/routes/feedback.ts`, tests
  - Blocked by: 2.3, 3.3
  - Docs: `docs/how-to/ai-feature-development.md` step 7; `docs/reference/ai.md`
  - Acceptance: owner thumbs-down + flag succeeds; other user 403; admin succeeds; trace list filter `flaggedForDataset` / `thumbs`

## Phase 4 — Datasets and local experiments

- [ ] **Task 4.1**: Datasets + items (trace / manual / synthetic fields)
  - Delivers: CRUD; add-from-trace (single + bulk) copies input/output snapshot; `origin`, `tags`, `outcomeClass`, `expectedOutput`, `proofread`; dataset `expectedOutputSchema`
  - Files: dataset store + routes + tests
  - Blocked by: 2.3
  - Docs: how-to `ai-feature-development.md` steps 1–2 and 8
  - Acceptance: item retains sourceTraceId; delete item does not delete trace; bulk add-to-dataset; PATCH labels

- [ ] **Task 4.2**: Synthetic dataset generate
  - Delivers: `POST /datasets/:id/generate` via `AIService` + named generator constant; items `origin: synthetic`, `proofread: false`
  - Files: generate route + `ai/src/service/prompts.ts` generator constant, tests
  - Blocked by: 4.1, 1.2
  - Docs: how-to step 1 synthetic
  - Acceptance: generated items excluded from default experiment (`includeUnproofread` false)

- [ ] **Task 4.3**: Local ExperimentRunner always BackgroundTask + SOP gates
  - Delivers: POST experiment compares 2–3 prompt versions on a dataset, optional `modelOverride`, runs evaluators, stores per-item results, aggregates vs `SOP_DEFAULT_THRESHOLDS` (overridable), outlier + low-confidence item ids; promote → production label; skips unproofread unless opted in
  - Files: `ai/src/observability/local/experimentRunner.ts`, routes, tests
  - Blocked by: 4.1, 3.1, 2.2
  - Docs: how-to step 5–6
  - Acceptance: 1-item dataset still uses BackgroundTask; completed aggregates include pass/fail; promote moves label; failure sets experiment failed; default run ignores synthetic unproofread items

## Phase 5 — Langfuse adapter, OTel, admin, example

- [ ] **Task 5.1**: Langfuse TraceSink + ScoreSink wrapping existing client
  - Delivers: no second OTel SDK; best-effort; uses `getLangfuseClient()`
  - Files: `ai/src/observability/langfuse/traceAdapter.ts`, tests (mock client)
  - Blocked by: 1.2
  - Docs: explanation — LangfuseApp vs ObservabilityApp
  - Acceptance: generate with both sinks; langfuse mock throws → generate still ok; local row exists

- [ ] **Task 5.2**: Langfuse PromptRegistry / DatasetStore / ExperimentRunner adapters
  - Delivers: primaries can be `langfuse`; Terreno HTTP facade delegates; Open in Langfuse URLs on status
  - Files: `ai/src/observability/langfuse/*.ts`, tests
  - Blocked by: 5.1, 2.2, 4.3
  - Docs: how-to — switch primaries via env
  - Acceptance: prompts primary langfuse list uses client; experiments primary langfuse does not start BackgroundTask

- [ ] **Task 5.3**: `OtelTraceSink` OpenInference
  - Delivers: OTLP HTTP JSON or SDK exporter; `openinference.span.kind=LLM`; optional endpoint
  - Files: `ai/src/observability/otel/otelTraceSink.ts`, tests with mock exporter
  - Blocked by: 1.2
  - Docs: how-to — Phoenix/collector endpoint
  - Acceptance: mock exporter receives span with model + token attrs

- [ ] **Task 5.4**: `admin-frontend` screens
  - Delivers: prompts (production label), traces (SOP filters + add to dataset), costs, evaluators (SOP templates), datasets (label/origin/proofread/generate), experiments (model, thresholds, outliers, low confidence, explicit promote), review; status chip; hide review without local; wire `customScreens`
  - Files: `admin-frontend/src/widgets/aiObservability/*.tsx`, `builtInWidgets.ts`, `ai/src` adminContribution
  - Blocked by: 2.2, 2.3, 3.3, 3.4, 4.2, 4.3
  - Docs: `docs/reference/admin-frontend.md` screen names
  - Acceptance: widget tests empty/loading; `verify-ui-changes` on admin (login admin, walk SOP: Prompts → Datasets → Evaluators → Experiments → Traces add-to-dataset)

- [ ] **Task 5.5**: example-backend register + seed + env
  - Delivers: local plugin on; Langfuse sinks if keys; OTel if endpoint; seed prompt + SOP evaluators + empty `example-gold` dataset; fail-fast config
  - Files: `example-backend/src/server.ts`, seed script, `.env.example`
  - Blocked by: 5.1, 5.3, 2.2, 3.1
  - Docs: how-to uses example-backend snippet
  - Acceptance: server boots with local-only; invalid primary mix prevents listen (test or documented script)

- [ ] **Task 5.6**: Docs completeness + Langfuse IP pointer + prompt-governance skill
  - Delivers: explanation, observe-llm how-to, **ai-feature-development** how-to complete vs shipped UI; `docs/implementationPlans/terreno-langfuse-integration.md` see-also; skill: SOP + registry production prompts
  - Files: docs listed in IP; `.rulesync/skills/ai-prompt-governance/SKILL.md` + `bun run skills:sync`
  - Blocked by: 5.5
  - Docs: (this task)
  - Acceptance: a stranger can run the 8-step SOP from `docs/how-to/ai-feature-development.md` without reading the IP; register ObservabilityApp from observe-llm how-to
