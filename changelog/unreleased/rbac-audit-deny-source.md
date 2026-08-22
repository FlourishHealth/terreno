---
category: Changed
---

- Role assignment **preview** no longer writes `RbacAudit` denied-assign rows. Denied
  mutation audits are recorded only for the escalation `403` (`Cannot grant permissions
  you do not hold`); other failures are not stored as denials, and a failed audit write
  does not replace that original `403`.
- When a `PermissionSource` refresh fails with `staleOnFailure: "deny"` (the default),
  last-cached `deny` grants stay in force so IdP/ABAC restrictions do not lift. Additive
  `roles` / `permissions` from that source are still omitted.
