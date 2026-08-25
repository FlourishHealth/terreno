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

## Why this shape for product work

Flourish AI features follow an 8-step loop: gold dataset → labels → prompt versions → evaluators → experiments with gates → `production` label → live traces and in-app feedback → weak traces back into the dataset.

That loop is the product requirement, not an optional dashboard. Operator steps: [Develop an AI feature](../how-to/ai-feature-development.md). Registration and env: [Observe LLM calls](../how-to/observe-llm-calls.md). Models and routes: [AI reference](../reference/ai.md). Design lock: [implementation plan](../implementationPlans/ai-observability.md).

`AIRequest` remains the cheap per-call log. Observability traces are the nested, scored, user/session/cost record used in the SOP.
