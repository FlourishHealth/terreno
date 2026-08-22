# GitHub attention contract

Human attention is the scarcest resource. A PR must be understandable in one glance.
Put detail behind disclosure controls and post comments only when they cause a human
decision or preserve context that the diff cannot.

## Pull request title

- Describe the outcome in plain language.
- Use at most 72 characters.
- Do not use category prefixes, implementation detail, ticket IDs, or status words.

## Pull request body

Use exactly these top-level headings, in this order:

```markdown
## Why

<One or two sentences: problem, user/repository impact, and linked issue/spec if useful.>

## What changed

- <Outcome or behavior; maximum five bullets.>

## Verification

| Status | Scope | Evidence / action |
| --- | --- | --- |
| ✅ Tested | <behavior or risk> | `<command>` or artifact link |
| ⚠️ Not tested | <remaining risk> | <exact reviewer action> |
```

Rules:

- Keep the visible body under 250 words.
- Explain outcomes, not the implementation chronology.
- Omit empty rows and optional sections. If nothing remains untested, omit the
  `Not tested` row.
- Put the most decision-relevant verification first.
- Name what a check proves; a command alone is not evidence.
- Link one canonical issue/spec in `Why`; do not add a separate metadata section.
- Embed only the minimum screenshot/video needed to prove user-visible behavior.
- Put migration notes, full check logs, compatibility matrices, or unusual implementation
  detail in one optional block after the table:

  ```html
  <details>
  <summary>Details</summary>

  Concise supporting detail.

  </details>
  ```

- Do not add checklists, type-of-change sections, commit lists, generated summaries,
  badges, repeated acceptance criteria, or routine CI state.
- Preserve human-authored text when updating. Reformat it only when explicitly asked.

## Comments and review replies

Default to silence.

Post only when at least one is true:

1. A human must make a decision or take an action.
2. A review thread needs a non-obvious explanation that the diff cannot supply.
3. A requested change is intentionally not made and the tradeoff must be recorded.

Do not post progress updates, thanks, summaries of the PR body, test reports already in
the body, “ready for review” messages, or CI notifications.

Use the narrowest location:

- Reply in the existing review thread instead of posting a top-level comment.
- Update the PR body instead of commenting when verification evidence changes.
- Resolve an addressed thread silently when the fix is obvious from the diff.

Write at most three short sentences:

```markdown
**Action needed:** <one decision/action and why it blocks>.

<details>
<summary>Evidence</summary>

<only the detail needed to decide>

</details>
```

For a non-obvious resolved thread:

```markdown
Fixed in `<sha>`: <what changed and why this approach>.
```

Never split one update across several comments. Never post speculative findings. Never
quote long logs; link them or place the decisive excerpt in the expandable block.
