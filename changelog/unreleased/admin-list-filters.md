---
category: Fixed
---

- Admin lists no longer inherit public `queryFilter` scoping, and `adminFilter` Mongo
  operators are not rejected as client filters.
- Admin create/update/bulk-patch strip `excludeFields`, and list/read responses always
  run field scrubbing (including populated refs).
- Plugin admin contributions can forward `populatePaths` (Consent Responses populate user
  and form in the generic admin list).
- Example Files tab calls DocumentStorageApp at `/documents` (not `/admin/documents`).
