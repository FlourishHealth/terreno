---
name: terreno-4-brew
description: Move a Roast-verified implementation into GitHub review: final checks, branch hygiene, commit/push, PR setup, and evidence attachment. Exits after emitting PR/head state; does not wait for CI.
disable-model-invocation: true
---

# Brew — submit

Move one verified implementation into review, emit current PR/head state, and exit. The
outer loop invokes Taste separately.

Read the shared [`lifecycle contract`](../../references/lifecycle-contract.md) and
[`independent review procedure`](../../references/independent-review.md).

## Preconditions

- Roast returned `PASS` for the implementation being submitted.
- Branch/diff and verification evidence are available.
- No unresolved human gate remains.

## Inputs

- Approved IP/task and Roast result
- Current branch/head/diff and execution state
- Verification artifacts/evidence
- Repository instructions, available supporting skills, and PR template
- Existing PR title/body when updating (human edits are authoritative)

## Procedure

1. **Reconstruct.** Confirm the branch tree corresponds to the Roast-passed
   implementation. Behavioral changes after Roast return to Roast.
2. **Discover supporting skills.** Load applicable submission, documentation, commit,
   changelog, security, and repository verification skills.
3. **Run final gates.** Execute repository-required pre-submit checks. Confirm docs,
   generated files, changelog/release notes, and verification artifacts are complete.
4. **Review independently.** Review the full branch diff on separate standards and
   IP/spec axes. Fix material findings outside Brew via Pick/Roast; do not smuggle
   implementation work into submission.
5. **Check hygiene.** Review status/diff; exclude loop-owned execution state, debug output,
   secrets, credentials, customer data, and unrelated files.
6. **Commit.** Follow repository commit and DCO/sign-off policy. Preserve the existing
   prohibition on AI attribution. Use behavior-scoped commits; do not rewrite pushed
   history unless explicitly allowed.
7. **Push.** Push with upstream. Resolve only mechanical conflicts needed to update the PR,
   using repository conflict guidance and rerunning affected checks. A conflict requiring
   a design/behavior choice is `BLOCKED`.
8. **Create/update PR.** Apply the repository template. Preserve human-edited title/body;
   make only accurate minimal edits. Include IP/task links, checks, and evidence. Attach
   UI/runtime artifacts without sensitive data.
9. **Observe once.** Resolve the PR number/URL and pushed head SHA; confirm CI was
   triggered. Do not wait for completion.
10. **Record and exit.** Update execution state and emit `PASS` with the PR/head and
    `recommended_next_stage: taste`.

## Supporting skills

Follow the shared discovery procedure. Project skills own exact lint/type/test commands,
documentation generation, changelog rules, commit/DCO policy, PR templates, conflict
handling, and mandatory evidence gates.

## Evidence produced

- Final checks and independent-review outcomes
- Commit and pushed head SHA
- PR URL/number and preserved template/body state
- Attached artifact references and sensitive-data check
- Updated execution state and structured Brew result

## Success conditions

- Verified implementation is committed/pushed and the PR accurately represents it.
- CI is triggered for the recorded current head.
- Emit `PASS` with `recommended_next_stage: taste`, then exit.

## Failure conditions

Failed final checks, review findings, push errors, or PR setup errors emit `FAIL` with
evidence and the smallest corrective stage/action. Behavioral failures recommend Pick or
Roast, not an implementation fix inside Brew.

## Blocked conditions

Missing access, required human approval/decision, unsafe conflict, unavailable mandatory
submission capability, or sensitive-data risk emits `BLOCKED` with exact action required.

## Recommended next stage

- `PASS` → outer loop invokes a fresh Taste
- `FAIL` → stage named by evidence (`pick`, `roast`, or `brew`)
- `BLOCKED` → outer loop routes the named gate

For standalone compatibility, a human/runner may invoke Taste immediately after Brew
returns. Brew itself never executes Taste and never owns CI waiting.
