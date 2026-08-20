---
category: Fixed
---

- Admin lists no longer inherit public `queryFilter` scoping, and `adminFilter` Mongo operators
  are not rejected as client filters.
- Admin mutations and responses consistently scrub excluded fields, including populated refs.
- Plugin admin contributions forward `populatePaths`.
- Document Storage clients use the contributed `/documents` API path.
