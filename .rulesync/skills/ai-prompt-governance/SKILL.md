---
name: ai-prompt-governance
description: >-
  Invoke when adding, modifying, or reviewing any prompt used by `@terreno/ai`
  (AIService methods, system prompts, helpers). Provides prompt-as-constant
  rules, temperature preset guidance, logging requirements, and a testing
  checklist.
---
# AI Prompt Governance — `@terreno/ai`

`@terreno/ai` is a backend-only, provider-agnostic AI layer built on the Vercel AI SDK. Consuming apps inject a `LanguageModel` (Google, Anthropic, OpenAI, etc.) and call `AIService` methods. All requests are logged through the `AIRequest` model.

See `ai/src/service/aiService.ts` and `ai/src/service/prompts.ts` for the canonical implementation.

## Prompt Writing Rules

1. **Always a named constant** — Define prompts in `ai/src/service/prompts.ts` (or the consuming app's equivalent constants file). Never inline prompt strings in route handlers, services, or `AIService` method bodies.
2. **Self-contained** — A prompt should read coherently on its own. If you must inject runtime context, document why in a comment above the constant.
3. **Typed return** — If the prompt asks for structured JSON, define a matching TypeScript interface in `ai/src/types/index.ts` and parse against it on every response.
4. **Don't bake user-identifiable data into the prompt template itself** — inject it at call time as runtime parameters, never as defaults in the constant.

## Temperature Preset Guidance

Use the presets exported from `@terreno/ai`:

| Preset | Value | When to use |
|--------|-------|-------------|
| `DETERMINISTIC` | 0 | Structured extraction, classification, deterministic transforms |
| `LOW` | 0.3 | Summarization, translation, faithful rewording |
| `BALANCED` | 0.7 | General Q&A, balanced creativity |
| `DEFAULT` | 1.0 | Chat, open-ended responses |
| `HIGH` | 1.5 | Brainstorming, creative variation |
| `MAXIMUM` | 2.0 | Maximum variability — rarely the right choice |

Pick the lowest temperature that still produces good results. Don't override the default unless you can name a reason in the call site.

## Logging

Every `AIService` method already logs to the `AIRequest` model via the internal `logRequest()` call. Do not bypass `AIService` and call the Vercel SDK directly from routes — you lose request logging, error capture, and the `requestType` taxonomy.

Current `AIRequest.requestType` values include `"general"`, `"remix"`, `"summarization"`, `"translation"`, `"json_value"`, `"json_object"`, and `"json_array"`. If you add a new category, extend the type union in `ai/src/types/index.ts` and update the admin explorer filters in `ai/src/routes/aiRequestsExplorer.ts`.

Logging failures must never break the main flow — the existing pattern catches and logs internally. Preserve that behavior.

## Testing a Prompt Change

`@terreno/ai` tests inject a mock `LanguageModel` with `doGenerate` / `doStream` methods. See the mock pattern in `ai/src/aiApp.test.ts`. Never hit a live provider in unit tests.

1. Add or update a unit test that mocks `doGenerate` / `doStream` and asserts the prompt your code sends matches expectations.
2. Run against at least 3 inputs:
   - A normal/expected case
   - An edge case (empty input, very long input, missing optional fields)
   - An adversarial case that could break structured JSON output
3. For structured JSON: assert the response parses against the typed return interface.
4. If the prompt affects streaming behavior, mock `doStream` and assert the emitted chunks.

For a one-off manual smoke against a real provider, temporarily add `logger.debug("prompt test", {prompt, response})` in the `AIService` method, run locally, then remove the log before committing.

## Prompt Change Checklist

- [ ] Prompt is a named constant in `prompts.ts` (or app equivalent) — not inlined
- [ ] Prompt still produces valid, parseable structured JSON if applicable (tested with 3+ inputs)
- [ ] Temperature preset is appropriate (lowest viable for the task)
- [ ] Call goes through `AIService` (so `AIRequest` logging fires) — no direct Vercel SDK calls from routes
- [ ] If `requestType` taxonomy changed, the type union and admin explorer filters were updated
- [ ] No user-identifiable data baked into the prompt template (only injected at call time)
- [ ] Unit test added/updated with a mock model
- [ ] Commit message explains the behavioral change (the prompt is the behavior)

## Adding a New AI Feature

1. Define prompt(s) as named constants in `ai/src/service/prompts.ts`.
2. If structured JSON output, define the TypeScript interface for the return shape in `ai/src/types/index.ts`.
3. Add a method to `AIService` (or a new service class) that calls `generateText` / `generateTextStream` and goes through the existing logging path.
4. If exposing via HTTP, add a route in `ai/src/routes/` following the patterns in `gpt.ts` / `gptHistories.ts`. Use `createOpenApiBuilder` for OpenAPI docs.
5. Add an integration test with a mock model that verifies:
   - The prompt sent to the model matches the constant
   - The structured JSON return parses against the typed interface
   - `AIRequest.logRequest` is called with the correct `requestType`

## Common Pitfalls

- Calling the Vercel SDK directly from a route — bypasses logging and request typing
- Inlining a prompt string in a route handler — makes future changes invisible and untestable
- Using the wrong `requestType` value (or `"general"` as a catch-all) — degrades the admin explorer
- Setting `temperature` numerically instead of via a preset — drifts away from the documented presets
- Forgetting to type the JSON return — runtime parse failures show up later as confusing errors
