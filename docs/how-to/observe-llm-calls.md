# Observe LLM calls

Register observability on the backend. Registration **is** the feature flag. Then run product iteration in [Develop an AI feature](ai-feature-development.md).

## Register

```typescript
server.register(new ObservabilityApp({
  plugins: [localPlugin, langfuseAdapter, otelSink].filter(Boolean),
  control: {
    datasets: process.env.AI_OBS_DATASETS_PRIMARY ?? "local",
    experiments: process.env.AI_OBS_EXPERIMENTS_PRIMARY ?? "local",
    prompts: process.env.AI_OBS_PROMPTS_PRIMARY ?? "local",
    reviewQueue: "local",
  },
  priceMap: JSON.parse(process.env.AI_OBS_PRICE_MAP_JSON ?? "{}"),
  sampleRate: Number(process.env.AI_OBS_SAMPLE_RATE ?? 0),
}));
```

Keep existing `LangfuseApp` if you already use Langfuse keys. The Langfuse **adapter** must reuse `getLangfuseClient()` and must not start a second OpenTelemetry SDK.

Boot **fails** if `experiments.primary !== datasets.primary`, if `reviewQueue` is `langfuse`, or if a primary’s plugin is missing.

## Env

| Variable | Role |
| --- | --- |
| `AI_OBS_PROMPTS_PRIMARY` | `local` or `langfuse` (default `local`) |
| `AI_OBS_DATASETS_PRIMARY` | default `local` |
| `AI_OBS_EXPERIMENTS_PRIMARY` | must equal datasets |
| `AI_OBS_SAMPLE_RATE` | `0`–`1`, default `0` (live evals off) |
| `AI_OBS_PRICE_MAP_JSON` | `{ "gemini-2.5-flash": { "inputPerMTok": 0.1, "outputPerMTok": 0.4 } }` |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | existing Langfuse plugin |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | optional OTLP trace sink |

## App generate calls

Pass identity and the production prompt ref so traces feed the SOP loop:

```typescript
await aiService.generateText({
  promptLabel: "production",
  promptName: "example-summarize",
  sessionId: req.header("x-ai-session-id"),
  userId: req.user?.id,
  variables: {text},
});
```

Opt out of tracing with `skipTrace: true`. Sink failures are logged and never fail the generate. `AIRequest` is still written.

## Admin

Open Terreno admin: Prompts, Traces, Datasets, Evaluators, Experiments, Review. **Open in Langfuse** appears when the Langfuse plugin is registered. Review is hidden when the local plugin is off.

## Create a prompt and pin production

Admin-only routes live under `/ai/observability`. Create the prompt in a folder, save later edits as `vN+1` (v1 stays immutable), then move `production` — the response names the outgoing version for the confirm modal.

```bash
# 1. Create v1 in a folder
curl -X POST "$API/ai/observability/prompts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"folder":"examples","name":"example-summarize","system":"Summarize {{text}}","template":"{{text}}","type":"text"}'

# 2. Pin production (first pin has no outgoing version)
curl -X POST "$API/ai/observability/prompts/example-summarize/labels" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"production","version":1}'

# 3. Save as v2, then move production (response.outgoingVersion is 1)
curl -X POST "$API/ai/observability/prompts/example-summarize/versions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"system":"Summarize {{text}} in one sentence","template":"{{text}}","type":"text"}'
curl -X POST "$API/ai/observability/prompts/example-summarize/labels" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"production","version":2}'
```

`GET /ai/observability/prompts?folder=examples&search=sum&include=usage7d` lists folder matches with 7-day call/cost rollups. A prompt with no `production` label returns `production: "—"`. Playground `POST /ai/observability/prompts/:name/playground` compiles `{{var}}`, runs one `AIService` call, and does not create a version.

## Review a trace

1. Install a human evaluator (`POST /ai/observability/evaluators/templates/correctness`).
2. Enqueue traces: `POST /ai/observability/traces/review` with `{evaluatorId, traceIds, reason: "manual"}`.
3. List oldest-first: `GET /ai/observability/review?status=pending` (response includes per-status counts).
4. Open an item: `GET /ai/observability/review/:id` returns evaluator dimensions plus `given` / `wrote` panels (variable labels when present, otherwise raw keys).
5. `POST /ai/observability/review/:id` with `action: "submit"` writes dimension-keyed scores through every ScoreSink and marks the item `done` (it leaves the pending list). `skip` and `assign` move status to `skipped` / `in_progress`.

