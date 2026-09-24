---
category: Fixed
---

`modelRouter` array subroutes now return a structured `400` error when the requested field is not an array, after preserving consumer update authorization hooks, instead of throwing an iterable `TypeError`.
