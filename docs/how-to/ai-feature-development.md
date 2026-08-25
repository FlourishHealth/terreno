# Develop an AI feature

Work this loop in **Terreno admin** when observability primaries are `local`. If prompts/datasets/experiments are Langfuse, the same screens proxy the vendor, or use **Open in Langfuse**.

Architecture: [AI observability](../explanation/ai-observability.md). Routes and models: [AI reference](../reference/ai.md). Register plugins: [Observe LLM calls](./observe-llm-calls.md).

Volume targets (how many gold items, class balance) live in the operator spreadsheet, not in Terreno. Use **tags** and **outcome class** so you can filter for balance.

## 1. Gather a gold dataset

1. Open **Datasets** → create a named set. Set `expectedOutputSchema` if product has agreed a label shape.
2. Add items in three ways:
   - **From production traces** (preferred for open-ended features): Traces list → filter → **Add to dataset**.
   - **Manual**: add an item that looks like production input.
   - **Synthetic**: **Generate** drafts. They land as `origin: synthetic` and `proofread: false`. Do not run experiments on them until a human proofreads and sets `proofread: true`.
3. Prefer a mix of true/false positives and negatives on classification features. Tag critical cases.

In-app **thumbs** / **false positive|negative** on a live feature write feedback scores and can **flag for dataset** (step 7). Those traces show up with `flaggedForDataset`.

## 2. Label expected output

1. Open the dataset item.
2. Fill `expectedOutput` to match the schema from step 1.
3. Set `outcomeClass` (`tp` / `fp` / `tn` / `fn`) when the feature is a flag.
4. Add `tags` for categories you will filter on later.
5. Set `proofread: true` on synthetic items you accept.

Skip unlabeled items in experiments unless you only need generation smoke (still prefer labels before scoring).

## 3. Create the prompt

1. Open **Prompts** → create a named prompt.
2. Save an immutable version (playground compile does **not** create a version).
3. Do not paste that string into app routes. Apps call `AIService` with `promptName` + `promptLabel` (step 6).

Judge prompts for evaluators are named constants or registry prompts — never inline in `AIService`.

## 4. Set up evaluators

**Evaluators** → **Create from template** (or custom):

| Feature shape | Template | Score |
| --- | --- | --- |
| Boolean flags (urgent, etc.) | `correctness` | boolean, LLM-as-judge |
| Open-ended text | `hallucination` | boolean `contains_hallucination` |
| Open-ended text | `helpfulness` | numeric 0–1 |
| Open-ended text | `toxicity` | boolean `is_toxic` |
| Open-ended text (if useful) | `conciseness` | numeric 0–1 |

Add more dimensions with product/engineering. Attach them to the experiment in step 5.

## 5. Run experiments

1. **Experiments** → dataset + prompt versions + **model** + evaluators.
2. Thresholds default to the SOP gates (override per run if product disagrees):

| Dimension | Gate |
| --- | --- |
| correctness true-rate | = 100% |
| hallucination true-rate | = 0% |
| helpfulness mean | ≥ 90% |
| toxicity true-rate | = 0% |

3. Wait for the run (`BackgroundTask` when local).
4. Skim **per-item outputs**. If they are nonsense, fix the prompt before trusting aggregates.
5. Read **pass/fail vs thresholds**. Open **outliers** and **low confidence** (default alert below 0.7). Use those items to rewrite the prompt.
6. Save a new prompt version. Repeat this step until gates pass (or product accepts a documented override).

Unproofread synthetic items are excluded unless you set `includeUnproofread`.

## 6. Deploy to production

1. On the winning version, move the **`production`** label (explicit; experiments never auto-promote).
2. In the app, resolve that label at call time:

```typescript
await aiService.generateText({
  promptLabel: "production",
  promptName: "example-summarize",
  userId: req.user?.id,
  variables: {text},
});
```

Missing `production` fails the request (400). Do not fall back to a hardcoded string.

## 7. Production tracing and feedback

Do this in parallel with steps 1–6 once the feature is reachable.

1. Register `ObservabilityApp`. Every `generate*` emits a trace unless `skipTrace`.
2. Pass `userId` and `sessionId` from the request.
3. From the product UI, call `POST /ai/observability/traces/:id/feedback` as the signed-in user:
   - `kind: "thumbs"` + `up` / `down` (helpfulness of suggestions)
   - `kind: "outcome"` + `tp` / `fp` / `tn` / `fn` (flags)
   - `flagDataset: true` to queue the trace as a dataset candidate

Feedback is a score (`source: "user-feedback"`) fanned out to every ScoreSink. Non-owners who are not admin get 403.

## 8. Add weak production traces back to the dataset

1. **Traces**: filter `thumbs=down`, `flaggedForDataset`, `failedEval`, or `lowConfidence`.
2. **Add to dataset** (bulk allowed).
3. Label the new items (step 2).
4. Repeat steps 5–8.

## Checklist (one feature)

- [ ] Gold set exists with mixed origins and labels
- [ ] Prompt versions in the registry, not inlined in routes
- [ ] SOP (or custom) evaluators attached
- [ ] Experiment gates green or explicitly overridden
- [ ] `production` label on the winning version
- [ ] App calls `promptName` + `promptLabel`
- [ ] Live traces include user/session
- [ ] Product can send thumbs / outcome / flag-for-dataset
- [ ] Weak traces can be added back to the dataset
