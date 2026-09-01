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

The example backend always registers the local plugin. Its idempotent seed creates one
registry prompt (`examples/example-summarize` v1 labelled `production`) and one human
`correctness` evaluator. This makes the complete phase 1 loop walkable without Langfuse:
resolve the production prompt → emit a trace → inspect spans and sensitive I/O → send the
trace to Review → record a human score.

`AI_OBS_PRICE_MAP_JSON` belongs to deployment configuration because prices change
independently of prompt versions. A missing model price preserves token counts and omits
USD cost; it never invents `$0`.
