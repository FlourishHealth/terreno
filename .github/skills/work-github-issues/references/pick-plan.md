# Pick plan comment

This comment is the **Roast contract**. The issue body stays context. Pick implements
the tasks here; Roast proves this comment, not chat history.

## Marker

The first line must be exactly:

```html
<!-- terreno-pick-plan -->
```

Load the latest issue comment that starts with that marker. Ignore older plan
comments. When replacing a plan, post a new comment; do not silently edit the old
one. The superseded comment can stay.

## Body

```markdown
<!-- terreno-pick-plan -->
## Pick plan

**Issue:** #<n> <title>
**Outcome:** <one sentence, copied from the approved plan>

### Non-scope

- <boundary>

### Tasks

1. **<task name>**
   - Files/seams: `<path>` / `<symbol>`
   - Acceptance: <observable>
   - Verify: `<command>` or UI exercise
   - Docs: <page to update, or "none — no user-visible/architectural change">
   - Blocked by: none | task N

### Clarifications

- <question>: <approved answer>

### Roast

Roast each task against its Acceptance and Verify lines in this comment.
Do not treat the issue body as extra requirements unless a task cites it.
```

## Bounds

- One issue per Pick invocation. Do not batch unrelated issues.
- At most five tasks. If you need more, stop and invoke `terreno-1-grow`.
- Every task has Acceptance and Verify. A task without Verify is not approved.
- Docs follow the lifecycle documentation contract: user-visible or architectural
  change without a docs line is a Roast `FAIL`.

## Finding the plan

```bash
gh issue view "$NUMBER" --comments --json title,body,comments,url
```

Select the last comment whose `body` starts with `<!-- terreno-pick-plan -->`.
If none exists, do not Pick.
