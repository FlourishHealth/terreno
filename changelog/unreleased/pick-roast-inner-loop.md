---
category: Changed
---

Pick and Roast now run as an automated inner loop: implement one unblocked task, roast
it, then pick the next until the approved list is done. Brew starts only after every
in-scope task has Roast `PASS`. Plugin `terreno-planning` is `2.3.0`.
