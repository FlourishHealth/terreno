---
category: Added
---

The `terreno-planning` Cursor plugin (`2.3.0`) adds two outer-loop skills beside the
five stages: `terreno-planning-loop` walks the approved task list (default Grow once,
then Pick and Roast each remaining task; pass `phases=` to restrict to `grow`, `pick`,
`roast`, `brew`, and/or `taste`), and `terreno-taste-sweep` finds the author's open
non-draft PRs that are conflicting or failing and reinvokes Taste until each is
mergeable or blocked.
