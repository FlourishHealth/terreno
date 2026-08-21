---
category: Fixed
---

- Admin lists no longer inherit public `queryFilter` scoping, and `adminFilter` Mongo operators
  are not rejected as client filters.
- Admin mutations and responses consistently scrub excluded fields, including populated refs.
- Plugin admin contributions forward `populatePaths`.
- Document Storage clients use the contributed `/documents` API path.
- Admin search applies the same `queryFilter`/`adminFilter` as list CRUD.
- AI Request Explorer multi-type filters use `$in` instead of dropping the filter.
- Admin list search (`q`) is a case-insensitive partial match across `searchFields`.
- The filter drawer can clear all filters and disables Apply when the draft is unchanged.
- Admin config `name` is unique when the same Mongoose model is mounted at more than one
  `routePath`, and list search/bulk-patch metadata is looked up by path.
