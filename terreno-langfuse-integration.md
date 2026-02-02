# @terreno/langfuse

A TerrenoApp plugin that integrates [Langfuse](https://langfuse.com) into Terreno backends and frontends. Provides prompt management with Redis caching, OpenTelemetry tracing, Vercel AI SDK helpers, React hooks, and an admin UI — all wired up via `.install()`.

## Why

LLM apps need prompt versioning, observability, and iteration tools. Langfuse provides all of this, but integrating it requires boilerplate (client setup, caching, tracing config, admin endpoints). This package eliminates that — one `.install()` call on the backend, one `<Provider>` on the frontend.

## Architecture

```
Backend (.install)                    Frontend (<Provider>)
─────────────────                     ────────────────────
• Langfuse client init                • usePrompt(name) → cached prompt
• Redis prompt cache (required)       • usePrompts() → list all
• OpenTelemetry tracing setup         • useTrace() → telemetry helpers
• Admin API routes (/api/prompts,     • useEvaluation() → submit scores
  /api/traces, /api/playground)       • Admin UI pages (prompts, traces,
• Vercel AI SDK helpers                 playground, dashboard)
```

The backend proxies Langfuse's API behind authenticated admin routes. The frontend talks to those routes, never directly to Langfuse. Redis sits in front of all prompt fetches with configurable TTL.

## Data Models

```typescript
interface LangfuseAppOptions {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;              // default: Langfuse Cloud EU
  redis: RedisOptions | Redis;   // required — no optional in-memory fallback
  adminPath?: string;            // default: '/admin/langfuse'
  enableAdminUI?: boolean;       // default: true
  enableTracing?: boolean;       // default: true
  serviceName?: string;          // default: 'terreno-app'
  cache?: {
    promptTtlSeconds?: number;   // default: 60
    traceTtlSeconds?: number;    // default: 300
  };
  evaluation?: {
    enabled?: boolean;
    scoringFunctions?: ScoringFunction[];
  };
}

interface ScoringFunction {
  name: string;
  description: string;
  scoreType: 'numeric' | 'categorical' | 'boolean';
  categories?: string[];
  range?: { min: number; max: number };
}
```

## Package Structure

```
langfuse/src/
├── backend/
│   ├── LangfuseApp.ts       # TerrenoApp plugin class (.install entry point)
│   ├── client.ts             # Langfuse SDK wrapper (singleton)
│   ├── cache.ts              # Redis get/set with TTL, key prefixing, invalidation
│   ├── prompts.ts            # getPrompt, compilePrompt (cache-first → Langfuse fallback)
│   ├── tracing.ts            # NodeSDK + LangfuseSpanProcessor setup/shutdown
│   ├── vercel-ai.ts          # preparePromptForAI(), createTelemetryConfig()
│   ├── types.ts
│   └── routes/
│       ├── prompts.ts        # CRUD + cache invalidation
│       ├── traces.ts         # List/view traces
│       ├── playground.ts     # Compile + test prompts
│       └── evaluations.ts    # Submit/retrieve scores (optional)
├── frontend/
│   ├── LangfuseProvider.tsx  # React context (apiBaseUrl, publicKey)
│   ├── hooks/                # usePrompt, usePrompts, useTrace, useEvaluation
│   ├── components/           # PromptEditor, PromptPlayground, TraceViewer, EvaluationForm
│   └── pages/                # PromptsPage, DashboardPage, TracesPage, PlaygroundPage
└── index.ts                  # Re-exports everything (backend + frontend)
```

## Implementation Phases

### Phase 1: Package scaffold + Langfuse client
Create `package.json`, `tsconfig.json`. Initialize Langfuse client singleton with support for Cloud EU/US and self-hosted URLs. Peer deps on `@terreno/api`, `@terreno/ui`, `react`, and optional `ai` (Vercel AI SDK).

### Phase 2: Redis cache layer
`cache.ts` — connect to Redis (accept existing client or options), cache prompts and traces with key prefixes (`langfuse:prompt:`, `langfuse:trace:`), TTL via `SETEX`, bulk invalidation via `KEYS` + `DEL`.

### Phase 3: Prompt management
`prompts.ts` — `getPrompt(name, opts)` checks Redis first, falls back to Langfuse SDK, caches result. `compilePrompt()` fetches + runs Langfuse's `{{variable}}` interpolation. Separate text and chat prompt helpers. `createPrompt()` and `updatePromptLabels()` write-through with cache invalidation.

### Phase 4: Tracing
`tracing.ts` — initialize `@opentelemetry/sdk-node` with `LangfuseSpanProcessor` from `@langfuse/otel`. `vercel-ai.ts` — helper that fetches a prompt and returns `{ prompt, telemetry, config }` ready to spread into `generateText()`.

### Phase 5: LangfuseApp plugin
The main class. `LangfuseApp.install(app, options)` wires up phases 1–4: init client, init Redis, start tracing, inject `res.locals.langfuse`, mount admin routes. Exposes `shutdown()` for graceful cleanup.

### Phase 6: React hooks
All hooks talk to the admin API routes, not Langfuse directly.
- `usePrompt(name)` — fetch + compile with `{{variables}}`
- `usePrompts()` — list all prompts
- `useTrace()` — start/end traces, get telemetry config for Vercel AI SDK
- `useEvaluation()` — submit scores to traces

### Phase 7: Admin UI
Built with `@terreno/ui` components. Pages: prompt list, prompt detail/editor, playground (compile + test with LLM), trace explorer, dashboard with counts. Components are also exported individually for embedding in custom admin pages.

### Phase 8: Public exports
Single `index.ts` re-exporting everything. Backend consumers get the plugin + utilities. Frontend consumers get the provider + hooks + components.

## Usage

```typescript
// Backend — one line to install
TerrenoApp.create({ ... })
  .install(LangfuseApp, {
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    redis: { host: 'localhost', port: 6379 },
  })
  .start();

// Backend — use in route handlers
const { prompt, telemetry, config } = await preparePromptForAI({
  promptName: 'answer-question',
  variables: { query },
  userId,
});
const result = await generateText({ model, prompt, ...config, experimental_telemetry: telemetry });

// Frontend — wrap app
<LangfuseProvider apiBaseUrl="/admin/langfuse/api">
  <App />
</LangfuseProvider>

// Frontend — use hooks
const { prompt, compile, isLoading } = usePrompt('chat-assistant');
```

## Key Decisions

- **Redis is required**, not optional. No in-memory fallback — keeps the caching layer simple and production-ready.
- **Frontend never talks to Langfuse directly.** All access goes through the backend admin routes, keeping keys server-side.
- **Evaluation is opt-in** via `evaluation.enabled`. Scoring functions are configured at install time.
- **Vercel AI SDK is an optional peer dep.** The `preparePromptForAI` helper is the primary integration point.

## Dependencies

| Package | Purpose |
|---------|---------|
| `langfuse` | Langfuse Node.js SDK (client, prompts, scoring) |
| `@langfuse/otel` | Langfuse OpenTelemetry span processor |
| `@opentelemetry/sdk-node` | OpenTelemetry Node SDK |
| `ioredis` | Redis client |

## Files to Modify Outside This Package

- **Root `package.json`**: Add `langfuse` to workspaces, add deps to catalog
- **`api/src/TerrenoApp.ts`**: Needs `.install()` method (may already exist from PR #149)
- **`example-backend/`** and **`example-frontend/`**: Add usage examples

## References

- [Langfuse TypeScript SDK](https://langfuse.com/docs/observability/sdk/typescript/overview)
- [Langfuse Prompt Management](https://langfuse.com/docs/prompt-management/get-started)
- [Vercel AI SDK Integration](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)
- [TypeScript SDK v4](https://langfuse.com/changelog/2025-08-28-typescript-sdk-v4-ga)
- [TerrenoApp PR #149](https://github.com/FlourishHealth/terreno/pull/149)
