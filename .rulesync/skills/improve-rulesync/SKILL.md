---
name: improve-rulesync
description: End-of-session pass to evaluate whether skills or rules were misleading, incorrect, or missing — then fix or create them (/improve-rulesync).
---
# Improve Rulesync

### Trigger
Invoke explicitly at the end of a session with `/improve-rulesync`.

### Behavior
Review the current conversation session and evaluate the skills and rules in `.rulesync/`. Identify any that:
- Gave misleading or incorrect guidance that caused errors or rework
- Were missing and would have prevented incorrect behavior
- Need to be updated to reflect decisions or patterns established in this session

Then make the changes directly.

### Step 1 — Session Review
Scan the session for:
- Moments where a skill or rule was followed but produced a wrong or suboptimal result
- User corrections or decisions about AI model behavior (these indicate a gap or error in the rules)
- New patterns, decisions, or constraints established that should be codified

### Step 2 — Rules Audit
Check `.rulesync/` for relevant existing rules and skills. Evaluate:
- Are trigger conditions accurate?
- Is the guidance still correct given what happened this session?
- Are there gaps that caused confusion?

### Step 3 — Make Changes
For each issue found:
- **Incorrect/misleading**: Edit the existing file to fix it
- **Missing**: Create a new skill or rule file in `.rulesync/skills/` or `.rulesync/rules/`
- **Outdated**: Update or remove the stale content

Always edit `.rulesync/` as the source of truth.

### Step 4 — Sync
After all changes, run `bun run rules` to sync to all AI tool directories.

### Step 5 — Summary
Output a brief summary of what was changed and why. Format:
- **Fixed**: [file] — [what was wrong and what was corrected]
- **Created**: [file] — [what gap it fills]
- **No changes needed**: [reason]
