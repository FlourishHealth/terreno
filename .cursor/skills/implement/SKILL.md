---
name: implement
description: Deprecated compatibility entry for direct IP implementation. Routes one approved task/slice to `terreno-2-pick`; contains no parallel TDD workflow.
disable-model-invocation: true
---
# Implement (deprecated compatibility shim)

Pick (`terreno-2-pick`) owns lifecycle implementation. This shim exists for concrete
existing `/implement` callers.
Invoke it explicitly; generated agent formats that cannot encode
`disable-model-invocation` must still treat it as user-invoked only.

1. Require an approved IP/task and one current unblocked slice.
2. Load/invoke Pick with the IP, task, execution state, branch/head, prior results, and
   applicable acceptance criteria.
3. Return Pick's structured result unchanged.
4. Do not skip Roast or continue into submission.

Terreno-specific implementation rules come from applicable repo-local skills discovered
by Pick (API/UI/data/schema/test environment/prompt/etc.). If the lifecycle plugin is
unavailable, return `BLOCKED`; do not fall back to duplicated implementation instructions.
