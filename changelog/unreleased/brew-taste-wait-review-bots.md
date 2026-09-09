---
category: Changed
---

Brew and Taste now sleep until async review bots such as Bugbot and CodeQL finish on
the current head, then continue so they can react in the same invocation. Ordinary
product CI still uses Taste `PENDING` and the outer loop. Plugin `terreno-planning` is
`2.2.0`.
