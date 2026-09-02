# AI observability

Terreno ships Langfuse-like prompt versioning, nested traces, evaluators, datasets, experiments, and a local human review queue **inside `@terreno/ai`**, with operator UI in **`admin-frontend` only**.

## Why not Langfuse-only

Apps must iterate prompts without a required vendor account. `LangfuseApp` stays a second plugin. Traces and scores **fan out** to every registered sink (local Mongo, Langfuse, OTLP/OpenInference). Prompts, datasets, experiments, and the review queue have **one writer** each (a primary). The review queue is **local-only**.

That split is the two planes:

| Plane | Write | Admin read |
| --- | --- | --- |
| Telemetry (traces, scores) | All sinks, best-effort | Local if the local plugin is on, else Langfuse |
| Control (prompts, datasets, experiments, queue) | One primary per capability | That primary |

`experiments.primary` must equal `datasets.primary`. Defaults are all `local`.

`ObservabilityApp` fails boot (constructor throws) when:

| Error | Cause |
| --- | --- |
| `experiments.primary must equal datasets.primary` | Mixed dataset/experiment writers |
| `reviewQueue.primary must be local` | `reviewQueue` set to `langfuse` |
| `<capability> primary "<id>" has no plugin` | No registered plugin with that `id`, capability, and store |

Telemetry sinks still fan out even when a control primary is local-only.

Admin chrome lives in `admin-frontend`. One sidebar group **AI Observability** holds Prompts,
Traces, and Review (Review is omitted when the local plugin is off). Existing **AI Requests**
stays under **Screens**. Every observability screen shows breadcrumbs
`Admin / AI Observability / <Section> / <leaf>` and a status chip from `GET /ai/observability/status`.
Prompts are edited as immutable versions in admin (`Save as vN+1`); apps never inline the string.

## Why this shape for product work

Flourish AI features follow an 8-step loop: gold dataset → labels → prompt versions → evaluators → experiments with gates → `production` label → live traces and in-app feedback → weak traces back into the dataset.

That loop is the product requirement, not an optional dashboard. Operator steps: [Develop an AI feature](../how-to/ai-feature-development.md). Registration and env: [Observe LLM calls](../how-to/observe-llm-calls.md). Models and routes: [AI reference](../reference/ai.md). Design lock: [implementation plan](../implementationPlans/ai-observability.md).

`AIRequest` remains the cheap per-call log. Observability traces are the nested, scored, user/session/cost record used in the SOP.

## Phase 1 reference loop

The example backend always registers the local plugin. Its idempotent seed creates
`examples/example-summarize` with production on v1 and an experimental v2, the human
`correctness-human` evaluator, the automatic `schema-assert` evaluator, and a two-item
`example-gold` dataset. This makes the review and experiment loops walkable without Langfuse:
resolve the production prompt → emit a trace → inspect spans and sensitive I/O → send the
trace to Review → record a human score.

`AI_OBS_PRICE_MAP_JSON` belongs to deployment configuration because prices change
independently of prompt versions. A missing model price preserves token counts and omits
USD cost; it never invents `$0`.

## Phase 2 backend (evaluators, datasets, experiments)

With the local plugin registered and primaries set to `local`, the control plane now includes:

- **`llm-judge` and `json-assert` evaluators** — judges call `AIService.generateJsonObject` through a named registry prompt (`judgePromptName`); create/update rejects a judge when the prompt `outputSchema` omits a required dimension (the error names that key). `json-assert` supports path/constraint checks and a built-in mode that validates output against the prompt version `outputSchema`. Parse or generation failures record an error outcome instead of throwing to the caller. Seeded templates install `correctness` / `hallucination` / `helpfulness` / `toxicity` as `llm-judge`, `schema-assert` as `json-assert`, and `*-human` variants for the review queue.
- **Datasets** — CRUD plus item provenance (`origin`, `proofread`, `sourceTraceId`, tags, outcome class). Import accepts **JSON** (bare objects or structured rows) and **CSV** (quoted fields; `input.*` / `expectedOutput.*` column prefixes). Rows validate against the bound prompt input schema when configured. Adding from a trace copies I/O; sensitive traces always land `proofread: false`. Deleting an item never mutates the trace.
- **Experiments** — compare 2–3 prompt versions on a dataset with optional `modelOverride` (requires `aiServiceFactory` on `ObservabilityApp`), evaluator thresholds (defaulting to the SOP gates), **per-version gate tiles** (`gates[].version`), outlier/low-confidence item ids, and version-scoped promote (**409** when the selected version's gates fail). Unproofread items are excluded unless `includeUnproofread` is true. Local runs compile exact prompt versions and call `AIService.generateText` with compiled `prompt` + `systemPrompt` (no `promptName`/`promptLabel`). `ObservabilityApp` wires the local experiment runner from `aiService` at register time.

Operator UI for datasets and experiments ships in tasks 2.7–2.9; routes and stores are live for API clients and tests today.
