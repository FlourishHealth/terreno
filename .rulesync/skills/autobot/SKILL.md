---
name: autobot
description: Deprecated Terreno outer-loop compatibility profile. Routes verified work through Brew, then schedules fresh one-iteration Taste invocations from structured state until merge-ready or blocked.
disable-model-invocation: true
---

# Autobot (deprecated outer-loop compatibility profile)

Use the installed `terreno-planning` lifecycle. This file owns orchestration only; it does
not duplicate Brew/Taste engineering procedures.

## Inputs

- IP/task and loop-owned execution state
- Current branch/head and PR when present
- Latest structured lifecycle result

## Procedure

1. If no PR exists, require Roast `PASS`, invoke a fresh Brew, and persist its result.
2. Invoke a fresh Taste with the current state/PR/head.
3. Persist the emitted result and exit or schedule:
   - `PASS` → report merge-ready; stop
   - `PENDING` → wait outside the lifecycle agent for `next_check_after_seconds`, then
     schedule fresh Taste
   - `FAIL` → schedule only the recommended evidence-driven stage/action
   - `BLOCKED` → route the named human/external gate; stop
4. Never merge without explicit authorization.

Do not keep one agent context alive across changing CI/review state. Do not copy logic
from Brew, Taste, check-watcher, or respond-to-review into this shim.

If the lifecycle plugin or durable state transport is unavailable, return `BLOCKED`
instead of reverting to the former persistent in-context implementation.
