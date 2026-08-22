# Lifecycle contract

Grow, Pick, Roast, Brew, and Taste are **transitions**, not the orchestration loop.

| Owner | Responsibility |
| --- | --- |
| Outer loop | when to invoke, which agent, persistence, waiting, retry, stop, escalation |
| Lifecycle stage | how to perform one stage correctly and emit evidence |
| Repository skills | repository commands, architecture, safety rules, and domain conventions |
| Roast | whether the implementation satisfies the approved IP |
| State + evidence | what a fresh invocation needs from previous attempts |

Every stage reads durable inputs, performs one bounded transition, writes the execution
state, emits one result document, and exits. Never rely on conversational memory.

## Discover supporting skills

At the start of every stage:

1. Inspect skills exposed by the harness and repository (for example skill catalogs and
   repository skill directories).
2. Match their descriptions to the affected domains and the current stage.
3. Load applicable skills before acting. Record their names in `supporting_skills`.
4. If repository instructions require a capability and it is unavailable, return
   `BLOCKED`; never silently skip it.
5. If no skill applies, infer conventions from repository instructions, existing code,
   tests, package scripts, and recent analogous changes.

Do not assume any particular supporting skill name exists. Lifecycle skills describe
portable method; repository skills describe the repository.

## Stage result

Emit all keys below as a final fenced YAML document. Keep lists empty rather than
omitting keys. Status values are exactly `PASS`, `FAIL`, `BLOCKED`, or `PENDING`.
The machine-readable schema is [`stage-result.schema.json`](stage-result.schema.json).

```yaml
schema_version: 1
stage: roast
status: FAIL
ip: example-feature
task: T2
attempt: 2
branch: cursor/example-feature-abc
head_sha: abc123
pr: "456"
supporting_skills:
  - backend-api
completed:
  - Verified cursor pagination route behavior
checks:
  - name: cursor-pagination
    status: FAIL
    evidence: "bun test ...: expected 2 records, received 3"
artifacts: []
failures:
  - requirement: Cursor pagination is backwards compatible
    severity: blocking
    expected: No duplicate records across first, middle, and final pages
    actual: Final page repeats one record
    evidence: "test output or artifact path"
blockers: []
decisions_required: []
recommended_next_stage: pick
recommended_next_action: Fix duplicate cursor boundary and rerun the failing test
next_check_after_seconds: null
```

Evidence must be reproducible: command plus outcome, artifact path, API response, log
location, or PR/check URL. Never persist chain-of-thought or conversational transcripts.

## Execution state

The IP and task file remain authoritative for design and scope. Execution state is a
small loop-owned handoff, not another plan.

Use an existing repository convention when present. Otherwise use
`.terreno/execution/<ip-or-task-slug>.yaml`, conforming to
[`execution-state.schema.json`](execution-state.schema.json). The outer loop must preserve
or transport this file between fresh invocations. Do not commit it unless the repository
explicitly tracks execution state; Brew must exclude loop-owned state from PR commits.

Each invocation:

1. Read state and verify its branch/head/PR against reality.
2. Increment `attempt` for the invoked stage.
3. Consume `last_result` and prior failed approaches; do not repeat a failed approach
   without new evidence.
4. Perform the stage.
5. Replace `last_result`, merge artifact references, and set `next`.
6. Emit the same result to the caller so the loop can persist it elsewhere.

If no writable artifact exists, still emit the result. If the outer loop cannot preserve
that result for the next fresh invocation, return `BLOCKED` and name the missing state
transport.

## Failures, blockers, and retries

- `FAIL`: objective engineering or verification failure. Preserve exact evidence and
  recommend the smallest evidence-driven retry.
- `BLOCKED`: no safe engineering action exists now. Classify `human`, `environment`,
  `access`, or `external`; include the exact action or decision required.
- `PENDING`: changing external state is not terminal (primarily Taste). Include
  `next_check_after_seconds`; the **outer loop** waits and invokes again.
- `PASS`: this stage's success conditions are proven for the recorded head.

Human gates include unresolved product semantics, architecture/security/data ownership,
destructive or irreversible operations, permissions, public compatibility, significant
scope growth, and policy-required approval. Include options, tradeoffs, evidence, and a
recommended default when appropriate.

Bounded engineering retries must be hypothesis-driven. Unbounded observation belongs to
the outer loop, never inside a lifecycle skill.

