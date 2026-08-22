---
name: submit
description: >-
  Deprecated compatibility entry for repository users of `/submit`. Routes
  verified work to the lifecycle plugin's Brew stage; contains no independent
  submission implementation.
---
# Submit (deprecated compatibility shim)

The reusable lifecycle owns submission in **Brew** (`terreno-4-brew`). This shim exists
for concrete existing `/submit` callers; it is not a second source of submission rules.

1. Require a Roast `PASS` result for the current implementation. If missing, invoke Roast
   first or return `BLOCKED`.
2. Load/invoke `terreno-4-brew` from the installed `terreno-planning` plugin with the IP,
   task, execution state, branch/head, and verification evidence.
3. Return Brew's structured result unchanged.
4. Do not launch a CI watcher. The outer loop invokes fresh Taste iterations.

If the plugin is unavailable, return `BLOCKED` with installation as the required action.
Do not fall back to a duplicated local submit procedure.
