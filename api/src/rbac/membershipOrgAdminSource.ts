import {getOrgContext} from "../orgs/orgContext";
import type {PermissionSet} from "./statements";
import type {PermissionSource} from "./types";

export const MEMBERSHIP_ORG_ADMIN_PERMISSION_SOURCE_NAME = "membership-org-admin";

/** Grants applied when `Membership.roleName` is `org-admin` in the current org context. */
export const ORG_ADMIN_PERMISSION_BUNDLE: PermissionSet = {
  admin: ["access"],
  organization: ["read", "update", "manageMembers"],
};

export const membershipOrgAdminPermissionSource = (): PermissionSource => ({
  getGrants: async () => {
    const membership = getOrgContext()?.membership;
    if (membership?.roleName !== "org-admin" || membership.status !== "active") {
      return null;
    }
    return {
      permissions: {
        admin: [...ORG_ADMIN_PERMISSION_BUNDLE.admin],
        organization: [...ORG_ADMIN_PERMISSION_BUNDLE.organization],
      },
    };
  },
  name: MEMBERSHIP_ORG_ADMIN_PERMISSION_SOURCE_NAME,
  ttlMs: 0,
});
