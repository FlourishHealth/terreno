# Grilling — interactive design interview

Use this during Grow (and Grind) instead of dumping every unknown in one list.

Goal: shared understanding with the user, then write. Do not write the IP, task list, or
code until the user confirms the last round left no open questions.

Adapted from [grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md).
Do not copy tracker or Linear setup from that skill. Terreno artifacts stay IP + task files.

## Map a design tree, not a questionnaire

Every request has a tree:

- **Root:** the destination (what exists when this is done)
- **Branches:** decisions that change the design
- **Leaves:** facts (how the repo already works)

Work in **rounds**. Each round asks only the current **frontier**: questions whose
prerequisites are already settled. Deeper questions wait until their parent is decided.

Example: do not ask "which Linear project?" before "do we track this in Linear?".
Do not ask "which mock pattern?" before "which public seam is the tracer bullet?".

## Agent vs user

| Kind | Who | How |
| ---- | --- | --- |
| **Fact** | Agent | Look it up. Spawn explore/generalPurpose sub-agents. Read the repo. |
| **Decision** | User | Ask. Never invent product, scope, or UX choices. |

Do not ask the user anything a sub-agent can answer from the repo, docs, or git history.
If a lookup fails, say what you searched and ask one targeted question.

## Round loop

1. Research in parallel (sub-agents). Update the tree.
2. Compute the frontier (undecided questions whose parents are settled).
3. If the frontier is empty, state shared understanding in one short block and wait for
   confirmation. Then write.
4. If the frontier is not empty, ask **every frontier question in this round**, in one
   message. Number them. Recommend an answer for each. Then **stop and wait**.

Never ask only the first question when three are unblocked. Never proceed to the next
round from inferred answers. The user may answer a subset; unanswered items stay on the
frontier.

### Message shape (every grilling round)

Lead with one line: what this round is deciding.

Then for each frontier question:

```markdown
❓ **Q1** — **<short title>**: <context in one or two sentences>
Options (if they help): A / B / C
➡️ Recommend: <your answer, with one-line why>
---
```

Rules for the body:

- One decision per question.
- Recommend a default every time. The user can override in a word.
- Do not ask for facts you already looked up. Cite the finding in the question if it
  informs the decision.
- Cap the round at **five** questions. Park the rest as "later, after these".
- End the message. Do not write files, do not start Roast, do not summarize the whole
  plan yet.

### After the user replies

1. Record answers on the tree.
2. Unlock children. Drop questions the answers made irrelevant.
3. Research any new facts those answers created.
4. Next round, or confirm-and-write if the frontier is empty.

## Confirm-and-write

When the frontier is empty, send **only** this, then wait:

```markdown
Shared understanding:
- Destination: <one sentence>
- In: <comma-separated>
- Out: <comma-separated>
- Tracer: <collection / route / hook / CLI>
- Open risks: <none | one line>

Confirm and I will write the plan. Change any bullet if I have it wrong.
```

Do not write the IP until they confirm.

## Anti-patterns

- One giant question dump at the start
- Asking repo facts ("where is modelRouter defined?")
- Acting on a recommended answer the user has not accepted
- Recapping the entire interview at the end of every round
- Writing the IP in the same turn as unanswered questions
