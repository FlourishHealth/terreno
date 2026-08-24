# Async review bots

Brew and Taste **sleep in-process** until async review bots on the current head have
reported, then continue the stage so they can react. Product test CI is not this wait:
if only lint/unit/e2e jobs remain, Taste still emits `PENDING` and the outer loop waits.

## What counts

A review bot is an automated GitHub actor that posts a check run, code-scanning alert,
or PR review/comment after a push. Match by check name, app slug, or review author.
Examples:

- Cursor Bugbot
- GitHub CodeQL / code scanning
- Copilot or other review bots when they appear on the PR

Do not treat ordinary product CI (lint, typecheck, unit, e2e, build) as a review bot.

## When to wait

Wait after Brew has pushed or created the PR, and whenever Taste's current head has a
matched bot queued, in progress, or still inside the startup grace.

**Do not exit while a matched bot is queued or in progress.**

## Procedure

1. Record the current head SHA.
2. **Startup grace (90 seconds).** After a push, sleep 30 seconds and re-fetch checks,
   reviews, and comments. Repeat until a matched bot appears or 90 seconds have elapsed.
   If none appeared, they are not running; continue the stage.
3. **Completion wait.** If any matched bot is queued or in progress, sleep 30 seconds and
   re-fetch. Repeat until every matched bot is terminal, or 20 minutes have elapsed.
   Terminal means the check completed (success, failure, cancelled, skipped, timed out)
   or the bot posted a completed review/comment batch for this head.
4. **Timeout.** If still running at 20 minutes, stop waiting. Emit `PENDING` with
   `next: taste` and `wait: 120`. Record which bots are still running.
5. **Re-observe, then continue.** Use the post-wait snapshot. Brew records bot outcomes
   and does not implement fixes. Taste classifies bot findings and acts on actionable
   ones in this invocation.

Use the harness sleep primitive (for example a 30-second sleep). Do not busy-spin.

## Bounds

- This wait is only for review bots, never "until all CI is green."
- After Taste pushes a fix, wait again for review bots on the new head, then act on
  those results **once** in this invocation. A further push after that second act emits
  `PENDING` (`next: taste`); the outer loop owns later cycles.
- Unbounded watching of product CI remains outer-loop work.
