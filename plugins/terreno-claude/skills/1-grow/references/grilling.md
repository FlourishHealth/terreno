# Grilling — interactive design interview

Use this during Grow instead of dumping every unknown in one list.

Goal: shared understanding with the user, then write. Do not write the IP, task list, or
code until the user confirms the last round left no open questions.

Adapted from [grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md).
Do not copy tracker setup from that skill. Follow the consuming repository's artifact and
tracking conventions.

## Map a design tree, not a questionnaire

Every request has a tree:

- **Root:** the destination (what exists when this is done)
- **Branches:** decisions that change the design
- **Leaves:** facts (how the repo already works)

Work in **rounds**. Each round asks only the current **frontier**: questions whose
prerequisites are already settled. Deeper questions wait until their parent is decided.

Example: do not ask "which tracker project?" before "do we track this externally?".
Do not ask "which test double?" before "which public seam is the tracer bullet?".

## Agent vs user

| Kind | Who | How |
| ---- | --- | ---- |
| **Fact** | Agent | Look it up. Spawn explore/generalPurpose sub-agents. Read the repo. |
| **Decision** | User | Ask. Never invent product, scope, or UX choices. |

Do not ask the user anything a sub-agent can answer from the repo, docs, or git history.
If a lookup fails, say what you searched and ask one targeted question.

## Get to the bottom

A reply is not done until Pick can execute it without guessing.

After each user message:

1. Record what was actually chosen, not the wording of the reply.
2. If the answer is vague, partial, "sure", "yes", "whatever you think", or only restates
   the question, stay on that decision. Ask the missing concrete: who, which API, which
   UX, which data owner, which compatibility promise, what is out of scope.
3. If two answers conflict, name the conflict and re-ask the parent before unlocking
   children.
4. If a recommendation had sub-choices and they accepted it without picking one, grill
   the sub-choices.
5. Unlock children only when the parent is executable.

Do not treat a recommended answer as accepted unless the user confirmed it. Do not write
from inferred agreement.

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
- End the message. Do not write files, do not start Pick, do not summarize the whole
  plan yet.

### After the user replies

1. Record answers on the tree.
2. Get to the bottom of each answered item before treating it as settled.
3. Unlock children. Drop questions the answers made irrelevant.
4. Research any new facts those answers created.
5. Next round, or confirm-and-write if the frontier is empty.

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

## Approval summary

After writing, show a final verification index capped at 15 lines:

```markdown
Plan: <path>
Tasks: <path>
Destination: <one sentence>
In: <short tags>
Out: <short tags>
Tracer: <public seam>
Tasks: <count; frontier IDs; blocked IDs>
Verification: <criterion/method summary>
Supporting skills: <names or none found>
Next: approve → Pick
```

This is an index for fast approval, not a second copy of the IP. Do not compress
decisions into that index.

If any human decisions were grilled, add this table **after** the index, with no row
limit. List every settled decision. Skip the table entirely when there were none; do not
mention decisions, an empty table, or "none".

```markdown
| ID | Decision | Choice |
| --- | --- | --- |
| Q1 | <question title> | <chosen answer> |
```

## Anti-patterns

- One giant question dump at the start
- Asking repository facts ("where is this route defined?")
- Acting on a recommended answer the user has not accepted
- Accepting a vague "yes" as a finished decision
- Recapping the entire interview at the end of every round
- Writing the IP in the same turn as unanswered questions
- Hiding decisions in a one-line `Q#=choice` summary
