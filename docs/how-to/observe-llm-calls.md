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
